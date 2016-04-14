# midi-over-matrix
A real-time app for collaborative realtime music performing over the matrix.org network.

Roadmap
#####

- Implement as a chrome app interface (since firefox apps will support same format soon there shouldn't be portability problems)
- Use sockets to connect clients directly (not really usable since it probably requires NAT redirection for most users)
- Use matrix rooms to negotiate direct IP connections (fallback to matrix in case there's no possible connection?)
- Persist all transactions as matrix midi serial data
