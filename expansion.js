const os = require('os');

var expansion = {
    /**
     * This function will look at the rooms currently owner and scan a box around them to be discovered by other expansion methods.
     * For now, I only want it to scan around rooms I already own.
     * The main goal is to populate the Memory.rooms 
     */
    discoverRooms: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            if (!room.controller.my) // skip scanning if not my room
                continue;
            for (let x = parseInt(roomName[1]) - 1; x < parseInt(roomName[1]) + 2; x++) {
                if (x < 0) 
                    continue;
                for (let y = parseInt(roomName[3]) - 1; y < parseInt(roomName[3]) + 2; y++) {
                    if (y < 0) 
                        continue;
                    if (x == roomName[1] && y == roomName[3]) 
                        continue;

                    const n = `${roomName[0]}${x}${roomName[2]}${y}`;
                    if (!(n in Memory.rooms))
                        Memory.rooms[n] = {};
                }
            }
        }
    },

    /**
     * This function will iterate through the rooms and see when they were last scouted,
     * it will then send a scout and set Memory.expansion.currentRoom as the room name.
     * It will then create a flag with the scout prefix which will trigger a scout to be built.
     * This function only handles getting scouts to destinations, there is another thread that will update room details and 
     * delete the flag
     */
    scoutRoom: function() {
        if (!Memory.expansion) {
            Memory.expansion = {};
        }

        if (!Memory.expansion.currentRoom) {
            // time to find a new room, find rooms that haven't been scouted or are the least recently scouted room
            let earliestScouted = -1;
            let earliestRoomName = '';
            for (const roomName in Memory.rooms) {
                if (roomName in Game.rooms) // we already have vision continue
                    continue;
                const v = Memory.rooms[roomName];
                if (!v.lastScouted) { // never been scouted
                    earliestRoomName = roomName;
                    break;
                } else if (earliestScouted == -1 || v.lastScouted < earliestScouted) {
                    earliestScouted = v.lastScouted;
                    earliestRoomName = roomName;
                }
            }
            Memory.expansion.currentRoom = earliestRoomName;
        }
    },

    generateThreads: function() {
        let name = 'expansion-discover-rooms'
        if (!os.existsThread(name)) {
            const f = function() {
                expansion.discoverRooms();
            }
            os.newTimedThread(name, f, 20, 0, 100);
        }

        name = 'expansion-scout-rooms'
        if (!os.existsThread(name)) {
            const f = function() {
                expansion.scoutRoom();
            }
            os.newTimedThread(name, f, 20, 0, 30);
        }
    }
}

module.exports = expansion;