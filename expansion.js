const os = require('os');
const common = require('common');
const pathFinder = require('pathFinder');

const utilscreep = require('utilscreep');
const utilsroom = require('utilsroom');

var expansion = {
    /**
     * This function will look at the rooms currently owner and scan a box around them to be discovered by other expansion methods.
     * For now, I only want it to scan around rooms I already own.
     * The main goal is to populate the Memory.rooms 
     */
    discoverRooms: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            if (room.controller && !room.controller.my) // skip scanning if not my room
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
     * We want do a few things, 1. see if its any enemy room/unclaimed. 2. if its not reserved calculate if it is a good room to claim or 
     * just use for energy.  3. if it is claimed or has hostiles add information to the room in order for other threads
     * to determine if they should fight.
     */
    scoutRoomHelper: function(room) {
        // First let's check controller is it owned/reserverd
        const con = room.controller;
        if (!con) {
            room.memory.type = common.roomMapping.UNOWNED;
        } else if (con.owner != null) {
            // room is claimed
            room.memory.type = common.roomMapping.OWNED;
            room.memory.own = con.owner.username;
        } else if (con.reservation != null) {
            // room is reserved but not by us
            if (con.reservation.username != common.username) {
                room.memory.type = common.roomMapping.RESERVED;
                room.memory.own = con.reservation.username;
            } else // room is reserved by us
                room.memory.type = common.roomMapping.MY_RESERVATION;
        } else {
            // controller isn't reserved or controller
            room.memory.type = common.roomMapping.UNOWNED;
        }

        // Check for hostile/other creeps
        const enemies = room.find(FIND_HOSTILE_CREEPS, {filter: function(creep) {
            return creep.owner.username in Memory.allies && Memory.allies[creep.owner.username].enemy;
        }});
        room.memory.eCP = enemies.length > 0; // enemies currently present
        
        // check for minerals
        const minerals = room.find(FIND_MINERALS);
        for (const k in minerals) {
            const m = minerals[k];
            room.memory.minType = m.mineralType;
        }
    },

    isLayoutValid: function(room, array, xpos, ypos) {
        // first let's see if there is a 7x7 area
        for (let e = 1; e < 11; e++) {
            if (array[ypos + e][xpos] < 7) {
                return false;
            }
        }
        const x = xpos + 5;
        const y = ypos + 4;
        const currentPos = {
            pos: {x: x, y: y, roomName: room.name},
            room: room
        }

        // now let's see if we can navigate from spawn to all sources
        const sources = room.find(FIND_SOURCES);
        for (const k in sources) {
            const v = sources[k];
            const p = Room.deserializePath(pathFinder.find_path_in_room(currentPos, v.pos.x, v.pos.y));
            if (p.length == 0)
                return false;
        } 

        const controller = room.controller;
        const p = Room.deserializePath(pathFinder.find_path_in_room(currentPos, controller.pos.x, controller.pos.y));
        if (p.length == 0)
            return false;

        //todo build a cost matrix and pass it to room find code and see if after placing if anything is blocked
        return true;
    },

    findNextScoutRoom: function() {
        let earliestScouted = -1;
        let earliestRoomName = undefined;
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
    },

    /**
     * This function will iterate through the rooms and see when they were last scouted,
     * it will then send a scout and set Memory.expansion.currentRoom as the room name.
     * It will then create a flag with the scout prefix which will trigger a scout to be built.
     * It will also set the spawnMasterX spawnMasterY memory fields so if a room wants to be built it can
     */
    scoutRoom: function() {
        if (!Memory.expansion) {
            Memory.expansion = {};
        }

        // we are going to send a scout to this room
        if (!Memory.expansion.currentRoom) {
            // time to find a new room, find rooms that haven't been scouted or are the least recently scouted room
            expansion.findNextScoutRoom();
        }
        
        // we are no going to search all rooms that we have insight into that we don't own and give it a type
        // either none, reserve, or claim
        // highway rooms will be built by another function if we have a room too far away and we need a highway to connect them
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) // we own it skip
                continue;
                
            // lets go ahead and scout for enemies and other information
            expansion.scoutRoomHelper(room);
        }

        const room = Game.rooms[Memory.expansion.currentRoom]
        if (!room) // we can't see into room yet 
            return

        // lets check if the room has a controller, if it doesn't don't bother finding a placement
        if (!room.controller) {
            room.memory.lastScouted = Game.time;
            // now find the next room to scout
            expansion.findNextScoutRoom();
            return;
        }

        // here we will calculate best base layouts
        array = [];
        const t = room.getTerrain();
        for (let y = 5; y < 45; y++) {
            const yPosition = y - 5;
            array.push([]);
            for (let x = 44; x >= 5; x--) {
                const xP = x - 5;
                // check if its a wall
                if (t.get(x, y) == TERRAIN_MASK_WALL) {
                    array[yPosition][xP] = 0;
                    continue;
                }

                // now lets add 1 + the right
                if (x == 44)
                    array[yPosition][xP] = 1;
                else
                    array[yPosition][xP] = array[yPosition][xP+1] + 1;
            }
        }
        
        // now go through and find a base location
        let tempX = -1;
        let tempY = -1;
        let found = false;
        for (let y = 5; y < 38; y++) {
            const yPosition = y - 5;
            for (let x = 5; x <= 38; x++) {
                const xP = x - 5;
                const v = array[yPosition][xP];
                if (v < 11) {
                    x += v;
                } else if (expansion.isLayoutValid(room, array, xP, yPosition)) {
                    tempX = x;
                    tempY = y;
                    found = true;
                    break;
                }
            }
            if (found)
                break;
        }
        if (found) {
            room.memory.spawnMasterX = tempX + 5;
            room.memory.spawnMasterY = tempY + 4;
        }
        room.memory.lastScouted = Game.time;
        // now find the next room to scout
        expansion.findNextScoutRoom();
    },

    expandRooms: function() {
        return
        if (Object.keys(Memory.flags.captureAuto).length > 0) {
            // check if we have claimed the room yet
            const k = Object.keys(Memory.flags.captureAuto)[0];
            const room = Game.rooms[k];
            // check if no vision or if the room isnt claimed, if it isnt then return
            if (!room || !room.controller.my) {
                return; // we already have a room we are claiming skip
            }
            // we have both vision and the controller belongs to us, clear it
            delete Memory.flags.captureAuto[k];
            // clear flags
            const flags = room.find(FIND_FLAGS)
            for (const k in flags) {
                flags[k].remove();
            }
        }

        // go through rooms and see whats a good room to expand to, do 1 at a time and do it by closeness to a room we own
        // first get rooms we own
        let roomCount = 0;
        const roomNames = [];
        for (const k in Game.rooms) {
            const room = Game.rooms[k];
            if (room.controller && room.controller.my) {
                roomCount++;
                roomNames.push(k);
            }
        }
        if (roomCount >= Game.gcl.level) 
            return; // room count is max nothing to do

        // now go through rooms in memory and add to an array of all rooms that look okay to expand to
        const expandRooms = [];
        for (const k in Memory.rooms) {
            if (Game.rooms[k] != null && Game.rooms[k].controller && Game.rooms[k].controller.my) {
                continue; // room is already owned skip
            }
            const room = Memory.rooms[k];
            if (room.spawnMasterX != null && Object.keys(room.sources).length >= 2 && !room.eCP) {
                // room has a plan, more than 1 source, and isnt enemy controller
                expandRooms.push(k);
            }
        }

        // if we have not rooms return
        if (expandRooms.length == 0) {
            return;
        }

        // go through each room and see which is closest to a room we already own
        const mapping = utilscreep.getRoomToSpawnMapping();
        let closestDistance = 999999;
        let closestName;
        for (const k in expandRooms) {
            const room = expandRooms[k];
            const closestRoom = utilsroom.getClosestRoomFromRoom(mapping, room);
            let dis = Game.map.getRoomLinearDistance(closestRoom, room);
            if (dis < closestDistance) {
                closestDistance = dis;
                closestName = room;
            }
        }

        Memory.flags.captureAuto[closestName] = {};
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
            os.newTimedThread(name, f, 20, 0, 20);
        }

        name = 'expansion-expand-rooms'
        if (!os.existsThread(name)) {
            const f = function() {
                expansion.expandRooms();
            }
            os.newTimedThread(name, f, 20, 5, 100);
        }
    }
}

module.exports = expansion;