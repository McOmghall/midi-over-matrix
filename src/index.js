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

  $scope.login = function (username, password, homeserver) {
    var loginPromise = MatrixManager.login(username, password, homeserver)
    loginPromise.then(function (client) {
      $log.debug('After login: client')
      client.on('sync', function (state, prevState, result) {
        if (state == 'SYNCING') {
          $scope.$apply(function (scope) {
            $log.debug('On sync+scope.apply: Result (%s -> %s) %j', prevState, state, result)
            scope.ownRooms = client.getRooms()
            $log.debug('Own rooms: %j', scope.ownRooms)
            scope.isLoggedIn = state != null && state != 'ERROR'
          })
        }
      })
      client.startClient()
      return client
    })
  }

  $scope.stop = function () {
    if (MatrixManager.client) {
      MatrixManager.client.stopClient()
      $scope.isLoggedIn = false
    }
  }

  $scope.startJamming = function (roomId) {
    $log.debug('Adding jamming status to %s', roomId)
    var jamPromise = client.sendStateEvent(roomId, 'm.midi.jamming', {jamming: true}, undefined)
    jamPromise.then(function success (result) {
      $log.debug('Result of jamming: %j', result)
    })
    jamPromise.catch(function error (result) {
      $log.debug('Error in jamming: %j', result)
    })
  }
}]

angular.module('MidiOverMatrix', [])
  .service('MidiManager', midiManager)
  .service('MatrixManager', matrixManager)
  .controller('MidiOverMatrixCtrl', midiOverMatrixCtrl)
