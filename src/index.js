var angular = require('angular')
var midiManager = require('./midi-manager')
var matrixManager = require('./matrix-manager')

var midiOverMatrixCtrl = ['MatrixManager', 'MidiManager', '$scope', '$log', '$interval', function (MatrixManager, MidiManager, $scope, $log, $interval) {
  // Default homeserver
  $scope.user = {}
  $scope.user.homeserver = 'https://matrix.org'
  $scope.isLoggedIn = false
  $scope.ownRooms = []
  $scope.publicRooms = []

  MidiManager.start()
  MidiManager.on('data', function (data) {
    $log.debug('Received midi data %j', data)
  })

  // This packs the client for uses on scope functions
  // .then's must return the client they use for other functions
  var loginPromise = null

  $scope.login = function (username, password, homeserver) {
    loginPromise = MatrixManager.login(username, password, homeserver)
    loginPromise.then(function (client) {
      $log.debug('After login: client')
      client.on('sync', function (state, prevState, result) {
        if (state == 'SYNCING') {
          $scope.$apply(function () {
            $scope.ownRooms = []
            $log.debug('On sync+scope.apply: Result (%s -> %s) %j', prevState, state, result)
            $scope.ownRooms = client.getRooms()
            $log.debug('Own rooms: %j', $scope.ownRooms)
            $scope.isLoggedIn = true
          })
        }
      })
      client.startClient()
      return client
    })
  }

  $scope.stop = function () {
    $log.debug('Stopping client')
    if (loginPromise) {
      $log.debug('Stopped client')
      $scope.isLoggedIn = false
      loginPromise.then(function (client) {
        client.stopClient()
        $log.debug('Stopped client 2')
      })
    }
  }

  $scope.sendJammingEvent = function (roomId, jamming) {
    $log.debug('Adding jamming status %s to %s', jamming, roomId)

    if (loginPromise) {
      loginPromise.then(function (client) {
        var jamPromise = client.sendStateEvent(roomId, 'm.midi.jamming', {jamming: jamming}, undefined)
        jamPromise.then(function success (result) {
          $log.debug('Result of jamming: %j', result)
        })
        jamPromise.catch(function error (result) {
          $log.debug('Error in jamming: %j', result)
        })
      })
    }
  }
}]

angular.module('MidiOverMatrix', [])
  .service('MidiManager', midiManager)
  .service('MatrixManager', matrixManager)
  .controller('MidiOverMatrixCtrl', midiOverMatrixCtrl)
