var utils = require('utils');

const normal_creep = [CLAIM, MOVE, MOVE]; // 
//const normal_creep = [MOVE, MOVE]; // 300

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
];

const keyFlags = ['reserve', 'capture', 'captureAuto']
 
var militaryClaimer = {
    get_room_controller: function(creep) {
        if (creep.room.name != creep.memory.dstRoom) {
            return null;
        }
        return creep.room.controller;
    },

    find_loc: function(creep) {
        const f = Memory.flags;
        for (const ft in keyFlags) {
            const flagType = keyFlags[ft];
            const rooms = f[flagType];
            for (const roomName in rooms) {
                const l = rooms[roomName];
                if (flagType == 'reserve' && Object.keys(l).length == 2)
                    continue;
                if (flagType == 'capture' && Object.keys(l).length == 1)
                    continue;
                if (flagType == 'captureAuto' && Object.keys(l).length == 1)
                    continue;
                creep.memory.destLoc = {x: 22, y: 22, roomName: roomName};
                rooms[roomName][creep.name] = true;
                if (flagType == 'capture' || flagType == 'captureAuto') {
                    creep.memory.capture = true;
                }
                return true;
            }
        }
        return false;
    },
    
    run: function(creep) {
        // let's check if the current room is owned by us if it is we need to go elseware
        if (creep.spawning) {
            return;
        } 
        // todo delete below code and add if destLocNull
        if (creep.memory.destLoc == null) {
            // todo assign to a flag that doesn't have the members
            
            this.find_loc(creep);
        }

        if (creep.memory.destLoc == null) {
            return;
        }
        
        if (creep.memory.destLoc.roomName != creep.pos.roomName) {
            
            utils.move_to(creep, this.get_room_controller);
        } else {
            const obj = Game.getObjectById(creep.memory.destId);
            if (obj == null) {
                utils.move_to(creep, this.get_room_controller);
            } else {
                if (!creep.memory.capture && creep.reserveController(obj) == ERR_NOT_IN_RANGE) {
                    utils.move_to(creep, this.get_room_controller);
                } else if (creep.memory.capture && creep.claimController(obj) == ERR_NOT_IN_RANGE) {
                    utils.move_to(creep, this.get_room_controller);
                }
            }
        }
        
    },
	
	create_creep: function(spawn) {
        var newName = 'Claimer' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_scout][1], newName,
            {memory: {role: 'claimer', capture: false}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        const room_id = room.id;
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