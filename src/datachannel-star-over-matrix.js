require('webrtc-adapter')
const RTCPeerConnection = window.RTCPeerConnection
const EventEmitter = require('events')
const util = require('util')

util.inherits(DatachannelStarOverMatrix, EventEmitter)
function DatachannelStarOverMatrix (MatrixManager, $log) {
  EventEmitter.call(this)
  this.role = 'standard'
  const selfDatachannelStar = this
  const stunServers = ['stun:stun.l.google.com:19302']
  const stunTurnServers = MatrixManager.turnServers || []
  stunTurnServers.push({ urls: stunServers })
  const rtcConfig = { iceServers: stunTurnServers }

  /**
   * Generates a peer connection with a suitable configuration to operate with matrix
   */
  var generatePeerConnection = function generatePeerConnection () {
    $log.debug('Generating peer connection with config %j', rtcConfig)
    return new RTCPeerConnection(rtcConfig)
  }

  var channelName = function channelName (peerId, starterId, roomId) {
    return peerId + '=' + starterId + '<' + roomId
  }

  // WebRTC Various handlers
  // Use all outbound channels to send data (using next function as handler on channel)
  this.send = function send (data) {
    this.emit('send', JSON.stringify(data))
  }
  var sendHandler = function sendHandler (sender) {
    this.on('send', function (data) {
      $log.debug('Sending data over %s datachannels', this.listenerCount('send'))
      sender.send(data)
    })
  }
  var onRecvData = function onRecvData (message) {
    this.emit('data', JSON.parse(message.data))
  }
  var closeHandler = function closeHandler (sender) {
    this.on('close', function () {
      sender.close()
    })
  }
  var onIceCandidate = function (peerId, signallingManager, event) {
    $log.debug('New ICE candidate at %s %j', peerId, event)
    if (event.candidate !== null) {
      signallingManager.sendCandidate(event.candidate, peerId)
    }
  }
  // WebRTC Various handlers END

  /**
   * Connects to a given jam on a given room, identified by its starter
   * @param roomId the matrix room where the jam is taking place
   * @param starterId the matrix user id that started the jam
   * @param peerId the matrix user id of this client
   */
  this.connect = function connect (roomId, starterId) {
    if (this.role !== 'standard') {
      throw new Error('Only standard nodes can connect to initiators', 'datachannel-star-over-matrix')
    }
    var remoteConnection = generatePeerConnection()
    var dataChannel = remoteConnection.createDataChannel(channelName(MatrixManager.userId, starterId, roomId))
    closeHandler.bind(this)(dataChannel)
    dataChannel.onmessage = onRecvData.bind(this)

    // Signalling
    var signallingManager = new MatrixManager.SignallingManager(roomId, starterId, this.role)

    // Inbound signalling events (SDP answers and ICE candidates)
    signallingManager.on('m.midi.answer', function setRemoteDescriptionFromAnswer (clientInfo) {
      $log.debug('Received m.midi.answer: %j', clientInfo)
      remoteConnection.setRemoteDescription(clientInfo.answer)
    })
    signallingManager.on('m.midi.candidate', function setRemoteDescriptionFromOffer (clientInfo) {
      $log.debug('Received m.midi.candidate: %j', clientInfo)
      remoteConnection.addIceCandidate(clientInfo.candidate)
        .catch((error) => $log.error('There has been an error setting ICE %j on loopback', error))
    })

    // Outbound signalling (ICE candidates and SDP offer)
    remoteConnection.onicecandidate = onIceCandidate.bind(this, MatrixManager.userId, signallingManager)
    remoteConnection.createOffer()
      .then((offer) => remoteConnection.setLocalDescription(offer).then(function sendOffer () {
        $log.debug('Set local description on remote side. Sending offer %s -> %s %j', MatrixManager.userId, starterId, offer)
        signallingManager.sendOffer(offer, MatrixManager.userId)
      }))
      .catch((error) => $log.error('There has been an error setting local description on remote side %j', error))
  }

  /**
   * Starts this datachannel endpoint as star initiator (central node)
   */
  this.startAsInitiator = function startAsInitiator (roomId) {
    if (roomId == null) {
      throw new Error('You should specify a roomId')
    }
    this.role = 'initiator'
    this.startAsInitiator = null
    const signallingManager = new MatrixManager.SignallingManager(roomId, MatrixManager.userId, this.role)

    var candidates = []
    var queueCandidates = function queueCandidates (candidate) {
      candidates.push(candidate)
    }

    /**
     * Enqueue candidates that might arrive before offer
     */
    signallingManager.on('m.midi.candidate', queueCandidates)

    // For every offer, we start a datachannel negotiation
    signallingManager.on('m.midi.offer', function setRemoteDescriptionAndStartNegotiation (clientInfo) {
      $log.debug('Received m.midi.offer on room %s: %j', roomId, clientInfo)

      const peerId = clientInfo.userId
      const connection = generatePeerConnection()
      // On a successful negotiation, we assume the remote side has a datachannel and we bind to it
      connection.ondatachannel = (event) => {
        $log.debug('Adding datachannel %j', event)
        // Binds events on DatachannelStarOverMatrix to a newly connected datachannel:
        // 'send' events on DatachannelStarOverMatrix send data on all datachannels
        // 'close' events close all datachannels
        // received data on the channel triggers a 'data' event
        event.channel.onmessage = onRecvData.bind(selfDatachannelStar)
        event.channel.onopen = sendHandler.bind(selfDatachannelStar, event.channel)
        closeHandler.bind(selfDatachannelStar)(event.channel)
      }

      // Outbound signalling (ICE candidates, SDP answer to offer)
      connection.onicecandidate = onIceCandidate.bind(this, peerId, signallingManager)
      connection
        .setRemoteDescription(clientInfo.offer)
        .then(() => connection.createAnswer())
        .then((answer) => connection.setLocalDescription(answer).then(() => signallingManager.sendAnswer(answer, peerId)))
        .catch((error) => $log.error('There has been an error sending answer %j at room %s for user %s', error, roomId, peerId))

      signallingManager.removeListener('m.midi.candidate', queueCandidates)
      // Inbound signalling (ICE candidates, SDP offers -> generates Outbound SDP answers)
      signallingManager.on('m.midi.candidate', function addCandidate (clientInfo) {
        $log.debug('Received m.midi.candidate: %j', clientInfo)
        connection.addIceCandidate(clientInfo.candidate)
          .catch((error) => $log.error('There has been an error setting ICE %j at room %s for user %s', error, roomId, peerId))
      })

      if (candidates.length > 0) {
        candidates.forEach((candidate) => signallingManager.emit('m.midi.candidate', candidate))
      }
    })

    signallingManager.startJam()

    /**
     * Generates a loopback comm channel on this endpoint (i.e. every sent message is sent to a local datachannel endpoint that sends it back to the sender)
     * The local send channel is called 'loopbackSend' and this loopback channel, connecting to it, is called 'loopbackRecv'
     */
    const loopbackRemoteName = 'loopbackRecv'
    const loopbackLocalName = 'loopbackSend'
    const room = 'loopback'
    // Generate a datachannel to wait for our new loopback datachannel
    var localConnection = generatePeerConnection()
    var remoteConnection = generatePeerConnection()
    var loopbackSend = localConnection.createDataChannel(loopbackRemoteName + '=' + loopbackLocalName + ':' + room)
    loopbackSend.onmessage = onRecvData.bind(this)
    loopbackSend.onopen = sendHandler.bind(this, loopbackSend)
    closeHandler.bind(this)(loopbackSend)
    var loopbackRecv = null
    remoteConnection.ondatachannel = (event) => {
      loopbackRecv = event.channel
      // Send back everything received (this is a loopback channel)
      loopbackRecv.onmessage = (event) => loopbackRecv.send(event.data)
    }
    localConnection.onicecandidate = (e) => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch((error) => $log.error('There has been an error adding candidate on loopback to remote side %j', error))
    remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch((error) => $log.error('There has been an error adding candidate on loopback to local side %j', error))
    localConnection.createOffer()
      .then((offer) => localConnection.setLocalDescription(offer))
      .then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
      .then(() => $log.debug('Local description %j', localConnection.localDescription))
      .then(() => remoteConnection.createAnswer())
      .then((answer) => remoteConnection.setLocalDescription(answer))
      .then(() => localConnection.setRemoteDescription(remoteConnection.localDescription))
      .then(() => {
        $log.debug('Local/local connection %j %j', localConnection, loopbackSend)
        $log.debug('Local/remote connection %j %j', remoteConnection, loopbackRecv)
      }).catch((error) => $log.error('There has been an error creating loopback %j', error))
  }
}

module.exports = ['MatrixManager', '$log', DatachannelStarOverMatrix]
