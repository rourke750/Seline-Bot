const os = require('os');
const roomUtils = require('utilsroom');
const utilsCreep = require('utilscreep');
const common = require('common');
const rolesCanHarvester = require('roles.canHarvester');

const REQUEST_TYPE = {
    ROOM_TO_ROOM: 0,
    REMOTE_TO_ROOM: 1,
}

let roomInfo = {};
let countainerCount; // amount of containers that we can transport from
let roomToContainerMapping = {}; // room name to array of container ids
let containerIdToSourceIdMapping = {};
let sourceIdToContainerIdMapping = {};

// set up Memory needed
if (!Memory.transport) {
    Memory.transport = {};
}
/*
if (!Memory.transport.requests) {
    Memory.transport.requests = []; // requests are an array of work requests
}
if (!Memory.transport.jobs) {
    Memory.transport.jobs = {}; // jobs are the actively transported energy requests
}
if (!Memory.transport.roomToJobMapping) {
    Memory.transport.roomToJobMapping = {}; 
}
*/

const transport = {

    getTransportWant: function(rooms) {
        let want = 0;
        for (const k in rooms) {
            const oRoom = rooms[k];
            // check if we already own room
            if (Game.rooms[oRoom] && Game.rooms[oRoom].controller && Game.rooms[oRoom].controller.my) {
                continue;
            }
            // get sources for the room
            const sources = Memory.rooms[oRoom].sources;
            for (const id in sources) {
                //todo in future go through sources and distance to see how many we want
                // now go through the sources
                const source = sources[id];
                const containerId = sourceIdToContainerIdMapping[id];
                const c = Game.getObjectById(containerId); // check if the container is built yet
                if (!source.canCreep || !c || c instanceof ConstructionSite) {
                    // no can miner skip or no container yet or its a constructionsite
                    continue;
                }
                want += 1;
            }
        }
        return want;
    },

    getContainerFromSource: function(sourceId) {
        return sourceIdToContainerIdMapping[sourceId];
    },

    requestCanTransportWork: function(creep) {
        // this method will handle creeps wanting to start a route for picking up energy and then dropping it off 
        const oRooms = Game.map.describeExits(creep.room.name);
        for (const k in oRooms) {
            const oRoom = oRooms[k];
            if (oRoom in roomToContainerMapping) {
                for (const containerK in roomToContainerMapping[oRoom]) {
                    // neighbor room exists with canminer
                    const containerId = roomToContainerMapping[oRoom][containerK];
                    const container = Game.getObjectById(containerId);
                    if (!container) // if container isn't set then continue since we don't have vision into the room
                        continue;
                    // get source from container id and see if we can take its energy
                    const sourceId = containerIdToSourceIdMapping[containerId];
                    const energyWant = creep.store.getFreeCapacity();
                    const sourceWant = Memory.rooms[oRoom].sources[sourceId].totalEnergyWant;
                    if (energyWant + sourceWant < container.store.getUsedCapacity(RESOURCE_ENERGY)) {
                        creep.memory.destId = containerId;
                        creep.memory.destLoc = {roomName: oRoom};
                        creep.memory.sourceId = sourceId;
                        creep.memory.home_room = creep.room.name;
                        return true;
                    }
                }
            }
        }
        return false;
        // todo in the future can come back and make this more intelegent 
    },

    cleanupWork: function(jobId) {
        // if a creep died clean up the work
    },

    /**
     * This method is used to calculate how many transports are needed to move energy around
     * and for which room they should be created in.
    */
    calculateRemoteHarvesting() {
        // lets pull up the container mapping in roles.canHarvester
        const containerMapping = rolesCanHarvester.getContainerLookup;
        // now let's look at the mapping and see if we can see any of the containers
        // if we can we have vision and it shows up as a can miner in memory means we can harvest it
        containerCount = 0;
        roomToContainerMapping = {};
        containerIdToSourceIdMapping = {};
        for (const roomName in containerMapping) {
            roomToContainerMapping[roomName] = [];
            for (const sourceName in containerMapping[roomName]) {
                if (!Memory.rooms[roomName].sources[sourceName].canCreep)
                    continue; // no can miner skip
                const containerId = containerMapping[roomName][sourceName];
                // now take container id and map it to room
                roomToContainerMapping[roomName].push(containerId);
                containerIdToSourceIdMapping[containerId] = sourceName;
                sourceIdToContainerIdMapping[sourceName] = containerId;
                countainerCount += 1;
            }
        }
        
        // we want to go through each room and build routes that it needs
        /*
        const routes = {};
        for (const roomName in roomInfo) {
            if (roomName != 'W7N7')
                continue;
            // get the surronding rooms and see what containers we can get energy from
            const oRooms = Game.map.describeExits(roomName);
            routes[roomName] = {};
            for (const k in oRooms) {
                const oRoom = oRooms[k];
                if (oRoom in roomToContainerMapping) {
                    // neighbor room exists with canminer
                }
            }
        }
        */
    },

    handleTransportRooms: function(room) {
        let have = room.energyAvailable;
        let total = room.energyCapacityAvailable;
        // add in container if it exists
        const containerPos = room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+1);
        const containerId = roomUtils.doesStructureExist(containerPos, STRUCTURE_CONTAINER);
        if (containerId) {
            const container = Game.getObjectById(containerId);
            total += container.store.getCapacity();
            have += container.store.getUsedCapacity(RESOURCE_ENERGY);
        }

        // add storage if it exists
        const storagePos = room.getPositionAt(room.memory.spawnMasterX+1, room.memory.spawnMasterY+5);
        const storageId = roomUtils.doesStructureExist(storagePos, STRUCTURE_STORAGE);
        if (storageId) {
            const storage = Game.getObjectById(storageId);
            total += 500000;
            have += storage.store.getUsedCapacity(RESOURCE_ENERGY);
        }
        
        if (!(room.name in roomInfo))
            roomInfo[room.name] = {total:0, have:0};
        roomInfo[room.name].total = total;
        roomInfo[room.name].have = have;
    }
};

const f = function() {
    for (const k in Game.rooms) {
        const room = Game.rooms[k];
        if (!room.controller || !room.controller.my)
            continue;
        transport.handleTransportRooms(room);
    }
    transport.calculateRemoteHarvesting();
};

os.newThread('transport-energy-management', f, 10);

module.exports = transport;