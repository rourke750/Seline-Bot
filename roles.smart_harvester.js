var utils = require('utils');

const normal_creep = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
]

var roleSmartHarvester = {
    
    get_harvest_count: function(room) {
        sourceMapping = {}
        for (const sourceId in Memory.rooms[room.name].sources) {
            const s = Memory.rooms[room.name].sources[sourceId];
            if (s.finished) {
                // if we have a container that belongs to this source
                sourceMapping[s.container_x + '-' + s.container_y] = true
            }
        }
        const containers = room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                    return structure.structureType == STRUCTURE_LINK &&
                        sourceMapping[structure.pos.x + '-' + structure.pos.y] == true &&
                        structure.room.name == room.name;
                }
        });
        return containers.length;
    },
    
    run: function(creep) {
        utils.harvest_source(creep, false);
        const droppedTarget = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
        if (droppedTarget && creep.pickup(droppedTarget) == 0){};
        // handles setting up the claimed source
        if (creep.memory.claimed_source == null) {
            creep.memory.claimed_source = creep.memory.destId;
        }
        // handles setting the linked_claim
        if (creep.memory.claimed_source != null && creep.memory.claimed_target == null) {
            // the claimed target is null
            const x = Memory.rooms[creep.room.name].sources[creep.memory.claimed_source].container_x;
            const y = Memory.rooms[creep.room.name].sources[creep.memory.claimed_source].container_y;
            const loc = creep.room.getPositionAt(x, y);
            const structs = loc.lookFor(LOOK_STRUCTURES);
            let link_id = null;
            for (const i in structs) {
                const v = structs[i];
                if (v.structureType == 'link') {
                    link_id = v.id;
                    break;
                }
            }
            if (link_id == null) {
                // how the fuck is the link id null, was it destroyed???
                console.log('smart harvester link somehow missing????? ' + creep.name + ' ' + creep.pos)
                return;
            }
            creep.memory.claimed_target = link_id;
        }

        if (creep.memory.claimed_target == null) {
            return
        }

        const target = Game.getObjectById(creep.memory.claimed_target);
        if (creep.store.getUsedCapacity() > 0) {
            // transfer to container
            const tErr = creep.transfer(target, RESOURCE_ENERGY);

            // potentially the location initially picked for the smart creep is too far away to effeciently transfer energy
            // let's try fix that if its the case
            if (creep.memory.claimed_source != null && creep.pos.getRangeTo(Game.getObjectById(creep.memory.claimed_target)) > 1) {
                // if we aren't in range lets load all the spots and get the closest to the link
                const positions = creep.room.memory.sources[creep.memory.claimed_source].maxCreeps.positions;
                for (const posK in positions) {
                    const pv = positions[posK];
                    const roomPos = creep.room.getPositionAt(pv[0], pv[1]);
                    const v = roomPos.getRangeTo(target);
                    if (v <= 1) { // if it is a range of one then its the closest
                        //console.log('smart harvester eeeeeek1 ' + creep.name + ' ' + creep.pos + ' ' + roomPos)
                        creep.memory.destLoc = roomPos;
                        break;
                    }
                }
            } else if (creep.memory.claimed_source != null && creep.pos.getRangeTo(Game.getObjectById(creep.memory.claimed_source)) <= 1) {
                creep.memory.destLoc = creep.pos;
            }

            if (tErr == ERR_NOT_IN_RANGE) {
                //creep.moveTo(target, utils.movement_options);
                //creep.memory.destId = '9d330774017e6b9'
                utils.move_to(creep);
            } else if (tErr != ERR_FULL && tErr != 0) {
                console.log('smart harvester problem with transfer ' + tErr);
            }
        }
        
        if (target.cooldown == 0 && target.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            // send to the master link
            const masterTarget = Game.getObjectById(creep.room.memory.masterLink);
            transErr = target.transferEnergy(masterTarget);
            if (transErr != 0) {
                console.log('error with transfering energy to master ' + transErr)
            }
        }
    },
	
	create_creep: function(spawn) {
        var newName = 'Smart-Harvester' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_smart_harvester][1], newName,
            {memory: {role: 'smartHarvester', collecting: true, claimed_source: null, home_room: spawn.room.name}})

        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_smart_harvester == null || room.memory.upgrade_pos_smart_harvester == undefined) {
            room.memory.upgrade_pos_smart_harvester = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_smart_harvester][2];
        if (current_upgrade_cost > energy_available && room.memory.upgrade_pos_scout != 0) {
            // attacked need to downgrade
            room.memory.upgrade_pos_smart_harvester = build_creeps[build_creeps[room.memory.upgrade_pos_smart_harvester][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_smart_harvester][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_smart_harvester + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_smart_harvester = n[0];
            }
        
        }
    }
    
    
}

module.exports = roleSmartHarvester;