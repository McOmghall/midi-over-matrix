const util = require('util')
const Stream = require('stream')
const midimessage = require('midimessage')
const audioContext = new window.AudioContext()
const Soundfont = require('soundfont-player')
const instrumentNames = require('soundfont-player/instruments.json')

// static conf
const LOG_MIDI_MESSAGES = false
const LOG_MIDI_STATS = false
const LOG_MIDI_STATS_PERIOD = 100000

util.inherits(MidiManager, Stream)
function MidiManager ($interval, $window, $log) {
  Stream.call(this)
  var instrument = null
  this.midiAccess = {inputs: [], outputs: []}

  this.instrumentNames = instrumentNames
  this.selectedInstrument = instrumentNames[2]
  this.changeInstrument = function () {
    instrument = Soundfont.instrument(audioContext, this.selectedInstrument).then(function enrichPlayer (player) {
      $log.warn('Adding MIDI support to soundfont-player externally, please update soundfont-player ASAP')
      player.midiStartedNotes = {}
      player.proccessMidiMessage = function processMidiMessage (message) {
        if (message.messageType == null) {
          message = midimessage(message)
        }

        if (message.messageType === 'noteon' && message.velocity === 0) {
          message.messageType = 'noteoff'
        }

        switch (message.messageType) {
          case 'noteon':
            player.midiStartedNotes[message.key] = player.play(message.key, 0)
            break
          case 'noteoff':
            if (player.midiStartedNotes[message.key]) {
              player.midiStartedNotes[message.key].stop()
            }
            break
          default:
        }
        return player.midiStartedNotes
      }

      return player
    })
  }
  this.changeInstrument()

  this.webAudioPlay = function webAudioPlay (data) {
    instrument.then(function (player) {
      player.proccessMidiMessage(data)
      return player
    })
  }

  if (LOG_MIDI_STATS) {
    this.timeOfFirstNote = null
    this.throughput = 0
    this.bytesPerSecond = 0
    this.on('data', function catchStats (message) {
      this.throughput += 8 * 3 // Standard midi messages are 3 bytes long
      this.timeOfFirstNote = (this.timeOfFirstNote ? this.timeOfFirstNote : new Date())
    })
    var logStats = function logStats () {
      this.bytesPerSecond = this.throughput / (new Date() - this.timeOfFirstNote)
      $log.debug('Midi stats %s %s %s', this.throughput, this.timeOfFirstNote, this.bytesPerSecond)
    }
    $interval(logStats.bind(this), LOG_MIDI_STATS_PERIOD)
  }

  // MIDI HANDLING FUNCTIONS START
  var onMIDIMessage = function onMIDIMessage (message) {
    if (LOG_MIDI_MESSAGES) {
      $log.debug('Midi message received %j', message)
    }
    this.emit('data', midimessage(message))
  }
  onMIDIMessage = onMIDIMessage.bind(this)

  var onMIDIStateChange = function onMIDIStateChange (midiEvent) {
    if (LOG_MIDI_MESSAGES) {
      $log.debug('Midi status changed %j', midiEvent)
    }
    if (midiEvent.port.type === 'input') {
      midiEvent.port.onmidimessage = onMIDIMessage
    }
    this.emit('update')
  }
  onMIDIStateChange = onMIDIStateChange.bind(this)

  var onMIDISuccess = function onMIDISuccess (midi) {
    this.midiAccess = midi
    $log.info('Midi success: midi %j', this)
    var portsAtStartup = {inputs: [], outputs: []}
    this.midiAccess.inputs.forEach(function (port, key) {
      port.onmidimessage = onMIDIMessage
      portsAtStartup.inputs.push({key: key, port: port})
    })
    this.midiAccess.outputs.forEach(function (port, key) {
      portsAtStartup.outputs.push({key: key, port: port})
    })

    this.midiAccess.onstatechange = onMIDIStateChange
    $log.info('All ports %j', portsAtStartup)
    this.emit('update')
  }
  onMIDISuccess = onMIDISuccess.bind(this)

  var onMIDIFailure = function onMIDIFailure (e) {
    var errMessage = "No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim: " + e
    $log.error(errMessage)
    this.emit('error', e)
  }
  onMIDIFailure = onMIDIFailure.bind(this)
  // MIDI HANDLING FUNCTIONS END

  if ($window.navigator && typeof $window.navigator.requestMIDIAccess === 'function') {
    $log.info('Requesting midi access')
    $window.navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure)
  } else {
    $log.error('No Web MIDI support')
    onMIDIFailure("This browser doesn't have access to MIDI elements")
  }
}

module.exports = ['$interval', '$window', '$log', MidiManager]
