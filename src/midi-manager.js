const util = require('util')
const EventEmitter = require('events')

util.inherits(MidiManager, EventEmitter)

function MidiManager ($window, $log) {
  EventEmitter.call(this)
  var midiManager = this

  this.start = function start () {
    if ($window.navigator && typeof $window.navigator.requestMIDIAccess === 'function') {
      $log.debug('Requesting midi access')
      $window.navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure)
    } else {
      $log.error('No Web MIDI support')
    }
  }

  function onMIDISuccess (midi) {
    $log.debug('Midi success: midi %j', midi)
    midi.inputs.forEach(function (port, key) {
      $log.debug('Inputs: key %j port %j', key, port)
      port.onmidimessage = onMIDIMessage
    })
    midi.outputs.forEach(function (port, key) {
      $log.debug('Outputs: key %j port %j', key, port)
    })
  }

  function onMIDIFailure (e) {
    $log.debug("No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim " + e)
  }

  function onMIDIMessage (message) {
    $log.debug('Midi message received %j', message)
    midiManager.emit('data', message.data)
  }
}

module.exports = ['$window', '$log', MidiManager]
