var utils = require('utils');
const utilscreep = require('utilscreep');
const common = require('common');

const normal_creep = [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];

const CONTAINER_LOOK_UP = {}; // mapping of rooms to sources to container ids

function getContainer(roomName, sourceId) {
    // check if container exists in mapping if not load it, if not created return null;
    if (!(roomName in CONTAINER_LOOK_UP))
        CONTAINER_LOOK_UP[roomName] = {};
        
    if (CONTAINER_LOOK_UP[roomName][sourceId] && !Game.getObjectById(CONTAINER_LOOK_UP[roomName][sourceId])) {
        // we have a container look up but the object doesnt exist reset
        CONTAINER_LOOK_UP[roomName][sourceId] = null;
    }

    if (!(sourceId in CONTAINER_LOOK_UP[roomName])) {
        // try find it
        const coords = Memory.rooms[roomName].sources[sourceId].maxCreeps.positions[0];
        const structures = Game.rooms[roomName].lookForAt(LOOK_STRUCTURES, coords[0], coords[1]);
        for (const s in structures) {
            if (structures[s].structureType == STRUCTURE_CONTAINER) {
                CONTAINER_LOOK_UP[roomName][sourceId] = structures[s].id;
                break;
            }
        }
    }
    // check if there is maybe a construction site
    if (!CONTAINER_LOOK_UP[roomName[sourceId]]) {
        const coords = Memory.rooms[roomName].sources[sourceId].maxCreeps.positions[0];
        const structures = Game.rooms[roomName].lookForAt(LOOK_CONSTRUCTION_SITES, coords[0], coords[1]);
        for (const s in structures) {
            if (structures[s].structureType == STRUCTURE_CONTAINER) {
                CONTAINER_LOOK_UP[roomName][sourceId] = structures[s].id;
                break;
            }
        }
    }
    return CONTAINER_LOOK_UP[roomName][sourceId];
}

var roleCanHarvester = {

    getContainerLookup: CONTAINER_LOOK_UP,
    
    run: function(creep) {
        // check if spawning
        if (creep.spawning) {
            return;
        }

        // something derped and we lost the dst loc
        if (!creep.memory.destLoc) {
            const sources = Memory.rooms[creep.pos.roomName].sources;
            for (const sK in sources) {
                const source = sources[sK];
                if (source.canCreep && source.canCreep == creep.name) {
                    creep.memory.destId = sK; 
                    creep.memory.destLoc = {roomName: creep.pos.roomName};
                    break;
                }
            }
        }

        const source = Game.getObjectById(creep.memory.destId);
        if (source == null || creep.room.name != creep.memory.destLoc.roomName) {
            // we are not in right room lets move
            utils.move_to(creep);
        } else {
            // source is in room lets go
            // check if we have a path yet
            if (creep.memory.current_path == null || creep.memory.current_path[creep.room.name] == null) {
                // no path set lets get the destination path
                // for now let's just pick the first position
                const sM = creep.room.memory.sources[creep.memory.destId];
                const coords = sM.maxCreeps.positions[0];
                creep.memory.destLoc = {x: coords[0], y: coords[1], roomName: creep.room.name};
            }

            // if we arent in spot move
            if (creep.pos.x != creep.memory.destLoc.x || creep.pos.y != creep.memory.destLoc.y) {
                utils.move_to(creep);
                return;
            }

            let id = getContainer(creep.room.name, creep.memory.destId);
            if (!id) {
                // lets build a container
                creep.room.getPositionAt(creep.memory.destLoc.x, creep.memory.destLoc.y).createConstructionSite(STRUCTURE_CONTAINER);
                id = getContainer(creep.room.name, creep.memory.destId);
            }

            let container = Game.getObjectById(id);
            if (!container && id) {
                // check if we dont have a container but we have an id, need to clear cache
                CONTAINER_LOOK_UP[creep.memory.destLoc.roomName][creep.memory.destId] = null;
                id = getContainer(creep.room.name, creep.memory.destId);
                container = Game.getObjectById(id);
            }

            // check if we have energy and need to build
            if (container instanceof ConstructionSite && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                // try build
                creep.build(container);
            } else if (container instanceof StructureContainer && container.hits < container.hitsMax && 
                creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                // repair
                creep.repair(container);
            } else {
                // check if we are in reserved room
                if (creep.room.memory.type == common.roomMapping.RESERVED) {
                    // room is currently reserved by not us
                    return;
                }
                // can we harvest
                const hErr = creep.harvest(source);
                if (hErr != OK && hErr != ERR_NOT_ENOUGH_RESOURCES) {
                    // got to move closer
                    console.log('can miner harvest err', hErr);
                }
            }
        }
	},
	
	create_creep: function(spawn, sourceId, roomName) {
        var newName = 'CanHarvester' + roomName + '-' + spawn.name + '-' + Game.time;
        spawn.spawnCreep(normal_creep, newName,
            {memory: {
                role: common.creepRole.CAN_HARVESTER, 
                destId: sourceId, 
                destLoc: {roomName: roomName}
            }});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        
    },

    cleanUp(id) {
        
    }
};

module.exports = roleCanHarvester;