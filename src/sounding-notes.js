const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const noteOn = 144
const noteOff = 128
const c4 = 60
class SoundingNotes extends Set {
  constructor() {
    super()
  }

  update(message) {
    if (!message.data) {
      return
    }

    var noteInMessage = (message.data[1] - c4) % notes.length
    noteInMessage = (noteInMessage < 0 ? noteInMessage + notes.length : noteInMessage)
    noteInMessage = notes[noteInMessage]
    switch (message.data[0]) {
      case noteOn:
        this.add(noteInMessage)
        break
      case noteOff:
        this.delete(noteInMessage)
        break
    }
    return this
  }
}

SoundingNotes.prototype.toString = function toString () {
  var rvalArray = []
  this.forEach(function (value) {
    rvalArray.push(value)
  })
  return rvalArray.join(',')
}

module.exports = SoundingNotes
