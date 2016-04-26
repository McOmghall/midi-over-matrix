module.exports = ['$window', '$log', function ($window, $log) {
  var onMIDIFailure = function onMIDIFailure (e) {
    $log.debug("No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim " + e)
  }

  var onMIDISuccess = function onMIDISuccess (midi) {
    $log.debug('Midi success')
    var inputs = midi.inputs.values()
    // loop through all inputs
    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
      // listen for midi messages
      input.value.onmidimessage = onMIDIMessage
      // this just lists our inputs in the console
      var input = inputs.value
      $log.debug("Input port : [ type:'" + input.type + "' id: '" + input.id +
        "' manufacturer: '" + input.manufacturer + "' name: '" + input.name +
        "' version: '" + input.version + "']")
    }
  }
  this.connect = function _connect () {
    if ($window.navigator && 'function' === typeof $window.navigator.requestMIDIAccess) {
      $window.navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure)
    } else {
      console.error('No Web MIDI support')
    }
  }
}]
