const util = require('util')
const Stream = require('stream')
const midimessage = require('midimessage')
const SoundingNotes = require('./sounding-notes')
const audioContext = new window.AudioContext()
const Soundfont = require('soundfont-player')
const instrumentNames = require('soundfont-player/instruments.json')

util.inherits(MidiManager, Stream)
function MidiManager ($interval, $window, $log) {
  Stream.call(this)
  var soundingNotes = new SoundingNotes()
  this.midiAccess = {inputs: [], outputs: []}

  this.instrumentNames = instrumentNames
  this.selectedInstrument = instrumentNames[2]
  this.changeInstrument = function () {
    instrument = Soundfont.instrument(audioContext, this.selectedInstrument)
  }
  this.changeInstrument()

  this.webAudioPlay = function webAudioPlay (data) {
    instrument.then(function (instrument) {
      var midiState = instrument.proccessMidiMessage(data)
    })
  }

  // STATS
  var collectStats = true
  if (collectStats) {
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
    $interval(logStats.bind(this), 5000)
  }

  // MIDI HANDLING FUNCTIONS START
  var onMIDIMessage = function onMIDIMessage (message) {
    $log.debug('Midi message received %j', message)
    message.soundingNotes = soundingNotes.update(message)
    this.emit('data', midimessage(message))
  }
  onMIDIMessage = onMIDIMessage.bind(this)

  var onMIDIStateChange = function onMIDIStateChange (midiEvent) {
    $log.debug('Midi status changed %j', midiEvent)
    if (midiEvent.port.type === 'input') {
      midiEvent.port.onmidimessage = onMIDIMessage
    }
    this.emit('update')
  }
  onMIDIStateChange = onMIDIStateChange.bind(this)

  var onMIDISuccess = function onMIDISuccess (midi) {
    this.midiAccess = midi
    $log.debug('Midi success: midi %j', this)
    var portsAtStartup = {inputs: [], outputs: []}
    this.midiAccess.inputs.forEach(function (port, key) {
      port.onmidimessage = onMIDIMessage
      portsAtStartup.inputs.push({key: key, port: port})
    })
    this.midiAccess.outputs.forEach(function (port, key) {
      portsAtStartup.outputs.push({key: key, port: port})
    })

    this.midiAccess.onstatechange = onMIDIStateChange
    $log.debug('All ports %j', portsAtStartup)
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
    $log.debug('Requesting midi access')
    $window.navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure)
  } else {
    $log.error('No Web MIDI support')
    onMidiFailure("This browser doesn't have access to MIDI elements")
  }
}

module.exports = ['$interval', '$window', '$log', MidiManager]
