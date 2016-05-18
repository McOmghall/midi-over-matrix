const webrtcshim = require('webrtc-adapter')
const EventEmitter = require('events')
const util = require('util')

util.inherits(DatachannelMeshOverMatrix, EventEmitter)
function DatachannelMeshOverMatrix ($log) {
  EventEmitter.call(this)
  $log.debug('Webrtc Adapter %j', webrtcshim)

  this.send = function send (data) {
    this.emit('send', JSON.stringify(data))
  }

  var handleAddCandidateError = function handleAddCandidateError (error) {
    $log.error('There has been an error adding an ICE candidate %j', error)
  }
  var handleCreateDescriptionError = function handleCreateDescriptionError (error) {
    $log.error('There has been an error creating a description %j', error)
  }
  var onRecvData = function onRecvData (message) {
    $log.debug('Received message %j', message)
    this.emit('data', JSON.parse(message.data))
  }
  var attachHandler = function attachHandler (sender) {
    this.on('send', function (data) {
      sender.send(data)
    })
  }

  this.localConnection = new RTCPeerConnection()
  this.remoteConnection = new RTCPeerConnection()
  this.loopbackSend = this.localConnection.createDataChannel('loopback')
  this.loopbackSend.onmessage = onRecvData.bind(this)
  this.loopbackSend.onopen = attachHandler.bind(this, this.loopbackSend)
  this.loopbackRecv = null
  this.remoteConnection.ondatachannel = event => {
    this.loopbackRecv = event.channel
    this.loopbackRecv.onmessage = event => this.loopbackRecv.send(event.data)
  }

  this.localConnection.onicecandidate = e => !e.candidate || this.remoteConnection.addIceCandidate(e.candidate).catch(handleAddCandidateError)
  this.remoteConnection.onicecandidate = e => !e.candidate || this.localConnection.addIceCandidate(e.candidate).catch(handleAddCandidateError)
  this.localConnection.createOffer()
    .then(offer => this.localConnection.setLocalDescription(offer))
    .then(() => this.remoteConnection.setRemoteDescription(this.localConnection.localDescription))
    .then(() => $log.debug('Local description %j', this.localConnection.localDescription))
    .then(() => this.remoteConnection.createAnswer())
    .then(answer => this.remoteConnection.setLocalDescription(answer))
    .then(() => this.localConnection.setRemoteDescription(this.remoteConnection.localDescription))
    .then(() => {
      $log.debug('Local/local connection %j %j', this.localConnection, this.loopbackSend)
      $log.debug('Local/remote connection %j %j', this.remoteConnection, this.loopbackRecv)
    }).catch(handleCreateDescriptionError)
}

module.exports = ['$log', DatachannelMeshOverMatrix]
