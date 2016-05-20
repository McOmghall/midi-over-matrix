var angular = require('angular')
var midiManager = require('./midi-manager')
var matrixManager = require('./matrix-manager')
var datachannelMeshOverMatrix = require('./datachannel-mesh-over-matrix')

function MidiOverMatrixCtrl (DatachannelMeshOverMatrix, MidiManager, MatrixManager, $scope, $log, $interval) {
  // Default homeserver
  $scope.user = {}
  $scope.user.homeserver = 'https://matrix.org'
  $scope.isLoggedIn = false
  $scope.matrix = MatrixManager
  $scope.midi = MidiManager
  $scope.midiInBrowser = true

  var playOnBrowser = function playOnBrowser (data) {
    MidiManager.webAudioPlay(data)
  }
  $scope.manageMidiInBrowser = function () {
    DatachannelMeshOverMatrix.removeListener('data', playOnBrowser)
    if ($scope.midiInBrowser) {
      DatachannelMeshOverMatrix.on('data', playOnBrowser)
    }
  }

  $scope.manageMidiInBrowser()
  MatrixManager.on('update', function () {
    $scope.$apply()
  })
  MidiManager.on('update', function () {
    $scope.midi.inputsArray = []
    $scope.midi.midiAccess.inputs.forEach(function (port, key) {
      $scope.midi.inputsArray.push({key: key, port: port})
    })
    $scope.midi.outputsArray = []
    $scope.midi.midiAccess.outputs.forEach(function (port, key) {
      $scope.midi.outputsArray.push({key: key, port: port})
    })
    $scope.$apply()
  })
  MidiManager.on('data', function (data) {
    DatachannelMeshOverMatrix.send(data)
  })
}

var midiOverMatrixCtrl = ['DatachannelMeshOverMatrix', 'MidiManager', 'MatrixManager', '$scope', '$log', '$interval', MidiOverMatrixCtrl]

angular.module('MidiOverMatrix', [])
  .service('MidiManager', midiManager)
  .service('MatrixManager', matrixManager)
  .service('DatachannelMeshOverMatrix', datachannelMeshOverMatrix)
  .controller('MidiOverMatrixCtrl', midiOverMatrixCtrl)
