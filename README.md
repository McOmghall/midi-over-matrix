# midi-over-matrix
A real-time app for collaborative realtime music performing over the matrix.org network.

## How to use
You can turn on a local webserver at port 8080 with `npm install && npm start`. To use this you need a browser that supports `ES6`, the `Web MIDI API` and `Datachannels` over `WebRTC`. As of May 2016 the only browsers that cover the specs are Chrome 50 and Opera 37 (which I didn't test on).

You can check if your browser works using these links: [Datachannels](http://caniuse.com/#feat=rtcpeerconnection) [Web MIDI](http://caniuse.com/#feat=midi)

## Connection workflow
1. Jam starter creates room with invites to jam participants.
2. Jam starter sends message to created room with link to this app, so they can just click on it and join from their preferred client. This link contains just the room name and prompts the user to log-in inside the midi-over-matrix client.
3. Other participants can join ad-hoc while the room still exists given they are allowed to join the room (this is matrix.org specific) and they know the room link.

## Roadmap v2
- Single page app/Chrome app (doesn't use chrome app specifics, just pure HTML/js for websites)
- midi goes through WebRTC DataChannels (protocol To Be Defined, might work with raw MIDI data with a bit of sync work on clients)
- WebRTC signalling as Matrix Room Status Events (also midi jam session metadata)
- First version of protocol topology should implement a multi-way DataChannel (i.e. multiple users, perhaps star topology with jam initiator as central node)
- - Consider export generalized code for Matrix-js-sdk
- Persist all transactions as matrix midi serial data

## Roadmap v1 (deprecated)
- Implement as a chrome app interface (since firefox apps will support same format soon there shouldn't be portability problems)
- Use sockets to connect clients directly (not really usable since it probably requires NAT redirection for most users)
- Use matrix rooms to negotiate direct IP connections (fallback to matrix in case there's no possible connection?)
- Persist all transactions as matrix midi serial data
