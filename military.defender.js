var utils = require('utils');

const normal_creep = [TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,
    TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,
    ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,
    ATTACK,ATTACK,ATTACK,ATTACK,ATTACK];

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
]
 
var militaryDefender = {

    getEnemy: function(creep) {
        let t = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: function(creep) {
            return creep.owner in Memory.allies && Memory.allies[creep.owner].enemy && struct.pos.roomName == creep.memory.tRoom;
        }});
        if (t == null) {
            t = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter: function(struct) {
                return struct.owner.username in Memory.allies && Memory.allies[struct.owner.username].enemy 
                && struct.pos.roomName == creep.memory.tRoom && struct.structureType != "keeperLair";
            }});
        }
        return t;
    },
    
    run: function(creep) {
        if (creep.spawning) {
            return;
        }
        // first lets see if we have a destination room we need to go to and if we are not in it then move there
        if (creep.current_path == null && creep.pos.roomName != creep.memory.tRoom) {
            creep.memory.destLoc = {x: 22, y: 22, roomName: creep.memory.tRoom};
        }
        // move to room
        if (creep.pos.roomName != creep.memory.tRoom) {
            utils.move_to(creep);
        }

        if (creep.pos.roomName == creep.memory.tRoom && creep.memory.dstLoc == null) {
            creep.memory.destLoc = {x: 22, y: 22, roomName: creep.memory.tRoom};
        }

        if (creep.memory.destId == null) {
            utils.move_to(creep, this.getEnemy);
        }

        // move to enemy
        const enemy = Game.getObjectById(creep.memory.destId)
        if (enemy != null) {
            if (creep.attack(enemy) == ERR_NOT_IN_RANGE)
                utils.move_to(creep, this.getEnemy);
        } else {
            utils.move_to(creep, this.getEnemy);
        }
    },
	
	create_creep: function(spawn, dstRoom) {
        var newName = 'Defender' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_defender][1], newName,
            {memory: {role: 'defender', tRoom: dstRoom}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_defender == null || room.memory.upgrade_pos_defender == undefined) {
            room.memory.upgrade_pos_defender = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_defender][2];
        if (current_upgrade_cost > energy_available && room.memory.upgrade_pos_scout != 0) {
            // attacked need to downgrade
            room.memory.upgrade_pos_defender = build_creeps[build_creeps[room.memory.upgrade_pos_defender][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_defender][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_defender + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_defender = n[0];
            }
        
        }
    }
    
}

module.exports = militaryDefender;