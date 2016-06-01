var angular = require('angular')
var midiManager = require('./midi-manager')
var matrixManager = require('./matrix-manager')
var datachannelStarOverMatrix = require('./datachannel-star-over-matrix')

function MidiOverMatrixCtrl (DatachannelStarOverMatrix, MidiManager, MatrixManager, $scope, $log, $interval, $location) {
  // Default homeserver
  $scope.user = {
    homeserver: 'https://matrix.org'
  }
  $scope.user = Object.assign({}, $scope.user, $location.search())

  $scope.isLoggedIn = false
  $scope.matrix = MatrixManager
  $scope.midi = MidiManager
  $scope.midiInBrowser = true

  var handledErrors = {
    jamRoomNotSpecified: 'E_ROOM_NOT_SPECIFIED',
    jamRoomNotExists: 'E_ROOM_NOT_EXISTS',
    starterIdNotSpecified: 'E_STARTER_ID_NOT_SPECIFIED',
    starterIdNotExists: 'E_STARTER_ID_NOT_EXISTS'
  }
  $scope.errors = []

  $scope.getLoginButtonTxt = function getLoginButtonTxt () {
    switch ($scope.matrix.status) {
      case 'CONNECTING':
        return 'Connecting'
        break
      case 'CONNECTED':
      case 'PREPARED':
        return 'Downloading'
        break
      case 'SYNCING':
        return 'Data OK'
        break
      default:
        return 'Login'
    }
  }

  $scope.manageMidiInBrowser = function () {
    var playOnBrowser =
    $log.debug('Midi in browser %s %s', $scope.midiInBrowser, DatachannelStarOverMatrix.listenerCount('data'))
    DatachannelStarOverMatrix.removeAllListeners('data')
    if ($scope.midiInBrowser) {
      DatachannelStarOverMatrix.on('data', function playOnBrowser (data) {
        MidiManager.webAudioPlay(data)
      })
    }
  }
  $scope.manageMidiInBrowser()

  MatrixManager.on('update', function () {
    $scope.$apply()
  })

  var validateRoomId = function validateRoomId (roomId) {
    // TODO: use angular validation
    if (roomId == null) {
      $scope.errors.push(handledErrors.jamRoomNotSpecified)
      return false
    }

    if (!MatrixManager.checkRoomExists(roomId)) {
      $scope.errors.push(handledErrors.jamRoomNotExists)
      return false
    }
    return true
  }

  var validateStarterId = function validateStarterId (starterId) {
    // TODO: use angular validation
    if (starterId == null) {
      $scope.errors.push(handledErrors.starterIdNotSpecified)
      return false
    }

    if (!MatrixManager.checkUserExists(starterId)) {
      $scope.errors.push(handledErrors.starterIdNotExists)
      return false
    }
    return true
  }

  $scope.startJam = function startJam (roomId) {
    $log.debug('Starting jam at %s', roomId)
    if (!validateRoomId(roomId)) {
      return
    }

    DatachannelStarOverMatrix.startAsInitiator(roomId)
  }

  $scope.joinJam = function joinJam (roomId, starterId) {
    $log.debug('Joining jam at %s started by %s', roomId, starterId)
    if (!(validateRoomId(roomId) && validateStarterId(starterId))) {
      return
    }

    DatachannelStarOverMatrix.connect(roomId, starterId)
  }

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
    DatachannelStarOverMatrix.send(data)
  })
}

var midiOverMatrixCtrl = ['DatachannelStarOverMatrix', 'MidiManager', 'MatrixManager', '$scope', '$log', '$interval', '$location', MidiOverMatrixCtrl]

angular.module('MidiOverMatrix', [])
  .config(['$locationProvider', function ($locationProvider) {
    $locationProvider.html5Mode({enabled: true, requireBase: false}).hashPrefix('*')
  }])
  .service('MidiManager', midiManager)
  .service('MatrixManager', matrixManager)
  .service('DatachannelStarOverMatrix', datachannelStarOverMatrix)
  .controller('MidiOverMatrixCtrl', midiOverMatrixCtrl)
