# midi-over-matrix
A real-time app for collaborative realtime music performing over the matrix.org network. I appreciate any comments on the code, bug reports, feature requests. Feel free to open issues, pull requests and come chat at [#matrix-midi:matrix.org](https://vector.im/beta/#/room/#matrix-midi:matrix.org)

## How to use
You can turn on a local webserver at port 8080 with `npm install && npm start`. To use this you need a browser that supports `ES6`, the `Web MIDI API` and `Datachannels` over `WebRTC`. As of May 2016 the only browsers that cover the specs are Chrome 50 and Opera 37 (which I didn't test on).

You can check if your browser works using these links:

- [Datachannels](http://caniuse.com/#feat=rtcpeerconnection) 
- [Web MIDI](http://caniuse.com/#feat=midi)

## Connection workflow
0. (OPTIONAL) Jam starter creates room with invites to jam participants.
1. Jam starter sends message to created room with link to this app, so they can just click on it and join from their preferred client. This link contains just the room name and prompts the user to log-in inside the midi-over-matrix client.
2. Other participants can join ad-hoc while the room still exists given they are allowed to join the room (this is matrix.org specific) and they know the room link.

## Webrtc Design

### Connection star topology management

While jamming, jam starter is expected to set a peerConnection to itself:
1. Jam starter posts `m.midi.start` state event to `room` as `{jam: <jam id>, starter: <started_matrix_id>}`
2. For every user that wants to join the jam: send a `m.midi.requestConnection` event and wait
2. Jam starter generates offer (`SDP`) for a new remote connection and answers previous event with a `m.midi.connectionOffer` as `{ receiverId: <requester's matrix id>, sdp: <SDP> }`.
3. Users listen for `m.midi.connectionOffer` events and connect when one is created for their matrix user id.

End of jamming: 
1. Jam starter posts `m.midi.jamming` state event to `room` as `{jamming: false}` and closes peerConnections.

### Data handling

JAM PARTICIPANTS: Send all generated MIDI messages to STARTER, do not play them until echo received.
JAM STARTER: Sends all incoming MIDI messages to all PARTICIPANTS, acting as loopback for them.


## Roadmap v2
- Single page app/Chrome app (doesn't use chrome app specifics, just pure HTML/js for websites)
- midi goes through WebRTC DataChannels (protocol To Be Defined, might work with raw MIDI data with a bit of sync work on clients)
- WebRTC signalling as Matrix Room Status Events (also midi jam session metadata)
- First version of protocol topology should implement a multi-way DataChannel (i.e. multiple users, perhaps star topology with jam initiator as central node)
-- Consider export generalized code for Matrix-js-sdk
- Persist all transactions as matrix midi serial data

## Roadmap v1 (deprecated)
- Implement as a chrome app interface (since firefox apps will support same format soon there shouldn't be portability problems)
- Use sockets to connect clients directly (not really usable since it probably requires NAT redirection for most users)
- Use matrix rooms to negotiate direct IP connections (fallback to matrix in case there's no possible connection?)
- Persist all transactions as matrix midi serial data
