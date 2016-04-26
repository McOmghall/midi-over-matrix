var sdk = require('matrix-js-sdk')
module.exports = ['$log', function ($log) {
  this.client = null
  this.login = function login (username, password, homeserver) {
    $log.debug('Login with %s %s %s', username, password, homeserver)

    return sdk.createClient({baseUrl: homeserver}).loginWithPassword(username, password).then(function (result) {
      $log.debug('On login: Result %j', result)

      this.client = sdk.createClient({
        baseUrl: homeserver,
        accessToken: result.access_token,
        userId: result.user_id
      })

      this.client.on('sync', function (state, prevState, result) {
        $log.debug('On sync: Result (%s -> %s) %j', prevState, state, result)
      })

      return this.client
    })
  }
}]
