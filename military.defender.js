var utils = require('utils');

const normal_creep = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, 
    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
    ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK]; // 
//const normal_creep = [MOVE, MOVE]; // 300

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
]
 
var militaryDefender = {
    
    run: function(creep) {
        if (creep.spawning) {
            return;
        }
        creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS)
        
    },
	
	create_creep: function(spawn) {
        var newName = 'Defender' + Game.time;
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_defender][1], newName,
            {memory: {role: 'defender'}});
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
        if (current_upgrade_cost > energy_available) {
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