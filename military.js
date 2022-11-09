const common = require('common');
const utilscreep = require('utilscreep');

if (!Memory.allies) {
    Memory.allies = {}
}

const military = {
    
    watchRooms: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            return;
        }
        const events = room.getEventLog();
        const attackEvents = _.filter(events, f => f.event == EVENT_ATTACK || f.event == EVENT_OBJECT_DESTROYED);
        if (attackEvents.length == 0) {
            return;
        }

        for (const k in attackEvents) {
            const v = attackEvents[k];
            const caster = Game.getObjectById(v.objectId);
            if (!caster) {
                //console.log('military bug with event data caster null\n' + JSON.stringify(v));
                // if caster is null we do not have insight and might as well skip
                continue;
            }
            const target = Game.getObjectById(v.data.targetId);
            if (!caster.my && (utilscreep.containsPreviousCreepId(v.data.targetId) || 
                (target instanceof Creep && target.my) || (target instanceof Structure && room.controller && room.controller.my))) {
                // it's attacking me or something
                const attackerOwner = caster.owner.username;
                if (!(attackerOwner in Memory.allies)) {
                    Memory.allies[attackerOwner] = {};
                }
                if (!Memory.allies[attackerOwner].enemy) {
                    // has just become our enemy
                    Game.notify('We have just been attacked by ' + attackerOwner + ' they are now our enemy!');
                }
                Memory.allies[attackerOwner].enemy = true;
            }
        }
    },

    /**
     * Gets called from the creepconstruction build defenders method, in the future can return better numbers so it can determine 
     * how many defenders would be good to send
     */
    getDefendersNeeded: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            return;
        }

        if (roomName in Memory.flags.blacklist) {
            return;
        }

        if (!Memory.defenders) {
            Memory.defenders = {};
        }
        if (!(roomName in Memory.defenders)) {
            Memory.defenders[roomName] = {};
        }
        if (!Memory.defenders[roomName].creeps) {
            Memory.defenders[roomName].creeps = {};
        }

        // clear out old entries
        for(var i in Memory.defenders[roomName].creeps) {
            if(!Game.creeps[i]) {
                delete Memory.defenders[roomName].creeps[i];
            }
        }
        
        // now scan room for hostile creeps
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS, {
            filter: function(hCreep) {
                const u = hCreep.owner.username;
                if (u == 'Source Keeper')
                    return false;
                return Memory.allies[u] != null && Memory.allies[u].enemy;
            }
        });
        const hostileStructs = room.find(FIND_HOSTILE_STRUCTURES, {
            filter: function(hStruct) {
                const u = hStruct.owner.username;
                if (u == 'Source Keeper')
                    return false;
                return Memory.allies[u] != null && Memory.allies[u].enemy && hStruct.structureType != "keeperLair";
            }
        });

        if (hostileCreeps.length == 0 && hostileStructs == 0) {
            return null;
        }

        // calculate melee, range, and total health
        let totalHealth = 0;
        let totalMelee = 0;
        let totalRange = 0;
        const hostileNames = {};
        for (const k in hostileCreeps) {
            const c = hostileCreeps[k];
            totalHealth += c.hits;
            totalMelee += c.getActiveBodyparts(ATTACK);
            totalRange += c.getActiveBodyparts(RANGED_ATTACK);
            hostileNames[c.owner.username] = true;
        }
        for (const k in hostileStructs) {
            const c = hostileStructs[k];
            totalHealth += c.hits;
        }
        return [totalHealth, totalMelee, totalRange, hostileNames];
    },

    findHostilesFromRoomData: function() {
        const rooms = Memory.rooms;
        for (const k in rooms) {
            const roomData = rooms[k];
            if (!roomData.type) 
                continue;
            if (roomData.type == common.roomMapping.RESERVED || roomData.type == common.roomMapping.OWNED) {
                console.log(`Room ${k} is owned by ${roomData.own} and currently has enemies ${roomData.eCP}`);
            }
        }
    },

    generateThreads: function(roomName) {
        let name = 'military-' + roomName + '-enemies_detection'
        if (!os.existsThread(name)) {
            const f = function() {
                military.watchRooms(roomName);
            }
            os.newThread(name, f, 10);
        }
    }
}

module.exports = military;