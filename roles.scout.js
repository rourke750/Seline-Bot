var utils = require('utils');

const normal_creep = [MOVE];

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
];

let retry = 3;
let lastDst = null;
 
var militaryClaimer = {

    find_loc: function(creep) {
        if (lastDst != null && retry == 0) {
            // we tried getting the location 3 times time to try somewhere else
            Memory.rooms[Memory.expansion.currentRoom].lastScouted = Game.time;
            Memory.expansion.currentRoom = undefined;
            lastDst = null;
            retry = 3;
        }
        if (Memory.expansion.currentRoom) {
            creep.memory.destLoc = {x: 22, y: 22, roomName: Memory.expansion.currentRoom};
            lastDst = Memory.expansion.currentRoom;
            retry--;
        }
        
    },
    
    run: function(creep) {
        // let's check if the current room is owned by us if it is we need to go elseware
        if (creep.spawning) {
            return;
        }
        
        // if we have found room and now need to go to a new room
        if (Memory.expansion.currentRoom && Memory.expansion.currentRoom != creep.memory.dstRoom) {
            // new room, clear self
            utils.cleanup_move_to(creep);
        }

        if (creep.memory.destLoc == null) {
            this.find_loc(creep);
        }

        if (creep.memory.destLoc == null) {
            return;
        }
        utils.move_to(creep);        
    },
	
	create_creep: function(spawn) {
        var newName = 'Scout' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_scout][1], newName,
            {memory: {role: 'scout'}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_scout == null || room.memory.upgrade_pos_scout == undefined) {
            room.memory.upgrade_pos_scout = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_scout][2];
        if (current_upgrade_cost > energy_available && room.memory.upgrade_pos_scout != 0) {
            // attacked need to downgrade
            room.memory.upgrade_pos_scout = build_creeps[build_creeps[room.memory.upgrade_pos_scout][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_scout][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_scout + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_scout = n[0];
            }
        
        }
    }
    
}

module.exports = militaryClaimer;