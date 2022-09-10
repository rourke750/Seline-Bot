const transport = require('transport');
const utilsCreep = require('utilscreep');
const utils = require('utils');
const common = require('common');

const normal_creep = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];

const roleTransport = {
    
    run: function(creep) {
        // check if spawning
        if (creep.spawning) {
            return;
        }

        // tick the id to confirm we are going here
        if (creep.memory.sourceId && creep.memory.destLoc) { //todo for how im doing this now if its returning it will still tick
            utilsCreep.setLastTicked(creep.name, creep.memory.sourceId, creep.memory.destLoc.roomName);
        }

        // now check if we are full of energy and if we are cleanup and go back home to deliver
        if (creep.memory.pickup && creep.store.getFreeCapacity() == 0) {
            // full lets go home
            utils.cleanup_move_to(creep);
            creep.memory.destLoc = {roomName: creep.memory.home_room};
            creep.memory.pickup = false;
            creep.memory.sourceId = undefined;
        } else if (!creep.memory.pickup && creep.store.getUsedCapacity() == 0) {
            // go back to transporting
            utils.cleanup_move_to(creep);
            creep.memory.pickup = true;
        }

        if (creep.memory.pickup && !creep.memory.destId) {
            //todo check if we have a sourceid already picked
            // we want to pickup but our dest id is null lets request
            transport.requestCanTransportWork(creep);
        }

        let findDropOff = null;
        if (!creep.memory.pickup) {
            // set function
            findDropOff = utilsCreep.find_closest_drop_off_structure;
        }
        
        // now let's double check our dest id and if we have our dest we can start a moving
        if (!creep.memory.pickup) {
            utils.move_to(creep, findDropOff);
        } else {
            utils.move_to(creep, () => Game.getObjectById(transport.getContainerFromSource(creep.memory.sourceId)));
        }

        // can we pickup energy
        if (creep.memory.pickup) {
            const container = Game.getObjectById(creep.memory.destId);
            if (!container || container.pos.roomName != creep.pos.roomName) {
                // if we cant see container we cannot mine from it and if we are not in same room
                // even though we dont get a 0 code if we are too far away better to not call withdraw as there is some cost but 
                // checking if room is cheaper
                return
            }
            const err = creep.withdraw(container, RESOURCE_ENERGY);
            if (err == ERR_NOT_IN_RANGE) {
                return;
            }
            if (err != OK)
                console.log('transport error withdrawing ', err);
        }

        if (!creep.memory.pickup) {
            // see if we are close enough to deposit energy and if so do it
            const d = Game.getObjectById(creep.memory.destId)
            if (!d || d.pos.roomName != creep.pos.roomName) {
                // check comments for pickup above
                return;
            }
            const err = creep.transfer(Game.getObjectById(creep.memory.destId), RESOURCE_ENERGY);
            if (err == ERR_NOT_IN_RANGE) {
                return;
            }
        }
	},
	
	create_creep: function(spawn, sourceId=undefined, home_room=undefined) {
        if ((!sourceId && home_room) || (sourceId && !home_room)) {
            console.log('transport sourceid and home_room both have to be set if one or the other');
            return
        }
        var newName = 'Transport' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(normal_creep, newName,
            {memory: {role: common.creepRole.TRANSPORT, pickup: true, sourceId: sourceId, home_room: home_room}});
        if (Game.creeps[newName]) {
            if (sourceId == null && home_room == null) {
                transport.requestCanTransportWork(Game.creeps[newName]);
            }
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        
    },

    cleanUp(id) {
        
    }
}

module.exports = roleTransport;