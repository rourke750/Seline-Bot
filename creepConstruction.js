const utilscreep = require('utilscreep');
const utilsRoom = require('utilsroom');

const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');
const roleSmartHarvester = require('roles.smart_harvester');
const roleHauler = require('roles.hauler');
const roleScout = require('roles.scout');
const roleCanHarvester = require('roles.canHarvester');
const roleTransport = require('roles.transport');
const roleJanitor = require('roles.janitor');

const militaryClaimer = require('military.claimer');
const militaryDefender = require('military.defender');

const military = require('military');

const common = require('common');

const transport = require('transport');

var creepConstruction = {
    handle_build_order: function(spawnsMapping, roomName) {
        // exit if the room isnt ours
        if (!Game.rooms[roomName] || !Game.rooms[roomName].controller || !Game.rooms[roomName].controller.my) {
            return;
        }

        const spawns = spawnsMapping[roomName]
        for (const sK in spawns) {
            const spawn = spawns[sK];
            const roomHarvesters = utilscreep.get_role_home_filtered_creeps(roomName, 'harvester');
            const roomSmartHarvesters = utilscreep.get_role_home_filtered_creeps(roomName, 'smartHarvester');
            const roomHaulers = utilscreep.get_role_home_filtered_creeps(roomName, 'hauler');
            const smartCount = roleSmartHarvester.get_harvest_count(spawn.room);
            /* 
            first two if statements are involved with haulers and smart harvesters
            they will handle respawning more when needed
            third if statement will handle removing harvesters from spawning once we have smart harvesters as they
            are no longer needed. Can miners handle everything else
            */
            if (roomHaulers.length == 1 && roomSmartHarvesters.length < smartCount) {
                // if we have a hauler but not enough smart harvesters then build smart harvester
                const newCreep = roleSmartHarvester.create_creep(spawn); 
                if (newCreep != null) { // if new creep created add to list
                    utilscreep.add_creep(newCreep);
                }
            } else if (roomHaulers.length == 0 && roomSmartHarvesters.length > 0) {
                // we have a smart harvester but no hauler build it
                const newCreep = roleHauler.create_creep(spawn); 
                if (newCreep != null) { // if new creep created add to list
                    utilscreep.add_creep(newCreep);
                }
            } else if (roomHarvesters.length < 4 && roomHaulers.length == 0 && roomSmartHarvesters.length == 0) {
                // dont spawn room harvesters if we have haulers and smart harvesters
                const newCreep = roleHarvester.create_creep(spawn); 
                if (newCreep != null) { // if new creep created add to list
                    utilscreep.add_creep(newCreep);
                }
            } else {
                //todo move below code where it filters on home_room to utils package where we can cache per tick
                // todo doesnt make sense that we are doing this for every spawn remove
                const roomUpgraders = utilscreep.get_role_home_filtered_creeps(roomName, 'upgrader');
                const roomJanitors = utilscreep.get_role_home_filtered_creeps(roomName, common.creepRole.JANITOR);
                const claimers = utilscreep.get_filtered_creeps('claimer');
                if (roomUpgraders.length == 0) {
                    const newCreep = roleUpgrader.create_creep(spawn);
                    if (newCreep != null) { // if new creep created add to list
                        utilscreep.add_creep(newCreep);
                        continue;
                    }
                }
                // Now we want to see what percent of everything else is available and spawn accordingly
                const upgraderPer = utils.notZero((roomUpgraders.length / roleUpgrader.get_harvest_count(spawn.room)));
                const janitorsPer = utils.notZero((roomJanitors.length / roleJanitor.get_harvest_count(spawn.room)));
                const claimersPer = utils.notZero((claimers.length / utils.get_claimer_count()));
                const smartHarvesterPerr = utils.notZero((roomSmartHarvesters.length / smartCount));
                const haulersPerr = utils.notZero((roomHaulers.length / roleHauler.get_harvest_count(spawn.room)));
                
                const nextCreate = [
                    [upgraderPer, roleUpgrader],
                    [janitorsPer, roleJanitor],
                    [claimersPer, militaryClaimer],
                    [smartHarvesterPerr, roleSmartHarvester],
                    [haulersPerr, roleHauler]
                ];
                nextCreate.sort(function(a, b) {return a[0] - b[0]});
                if (nextCreate[0][0] < 1) {
                    if (!spawn.spawning) {
                        const newCreep = nextCreate[0][1].create_creep(spawn); // return new creep if created
                        if (newCreep != null) { // if new creep created add to list
                            utilscreep.add_creep(newCreep);
                        }
                    }
                }
            }
            if (spawn.spawning) { 
                var spawningCreep = Game.creeps[spawn.spawning.name];
                if (!spawningCreep)
                    continue;
                spawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    spawn.pos.x + 1, 
                    spawn.pos.y, 
                    {align: 'left', opacity: 0.8});
            }
        }
        const roomHarvesterss = utilscreep.get_role_home_filtered_creeps(roomName, 'harvester');
        const roomSmartHarvesters = utilscreep.get_role_home_filtered_creeps(roomName, 'smartHarvester');
        const roomHaulers = utilscreep.get_role_home_filtered_creeps(roomName, 'hauler');
        const roomUpgraders = utilscreep.get_role_home_filtered_creeps(roomName, 'upgrader');

        const roomHarvesters = utils.notZero((roomHarvesterss.length / 4));
        const upgraderPer = utils.notZero((roomUpgraders.length / roleUpgrader.get_harvest_count(Game.rooms[roomName])));
        const smartHarvesterPerr = utils.notZero((roomSmartHarvesters.length / roleSmartHarvester.get_harvest_count(Game.rooms[roomName])));
        const haulersPerr = utils.notZero((roomHaulers.length / roleHauler.get_harvest_count(Game.rooms[roomName])));
        
        const text = `up ${upgraderPer.toFixed(2)} sH ${smartHarvesterPerr.toFixed(2)} haul ${haulersPerr.toFixed(2)} harv ${roomHarvesters.toFixed(2)}`;
        Game.rooms[roomName].visual.text(
            text,
            Memory.rooms[roomName].spawnMasterX, 
            Memory.rooms[roomName].spawnMasterY + 7, 
            {align: 'center', opacity: 0.8}); 
    },

    handle_build_no_spawns_scout(spawnsMapping) {
        if (!Memory.expansion.currentRoom) {
            return;
        }
        const roomName = Memory.expansion.currentRoom;
        let closestRoomName = utilsRoom.getClosestRoomFromRoom(spawnsMapping, roomName);

        for (const sK in spawnsMapping[closestRoomName]) {
            const scouts = utilscreep.get_filtered_creeps('scout');
            const spawn = spawnsMapping[closestRoomName][sK];
            if (spawn.spawning) {
                continue;
            }
            // scouts
            const scoutsPer = scouts.length;
            if (scoutsPer < 1) {
                const newCreep = roleScout.create_creep(spawn);
                if (newCreep != null) { // if new creep created add to list
                    utilscreep.add_creep(newCreep);
                    //console.log('building creep construction from ' + closestRoomName + ' destination ' + roomName);
                }
                continue;
            }
        }
    },

    handle_build_no_spawns_defender_helper: function(spawnsMapping, count, roomName) {
        let closestRoomArray = utilsRoom.getClosestRoomFromRoom(spawnsMapping, roomName, true);
        closestRoomArray.length = Math.min(closestRoomArray.length, 3); // get the 3 closest rooms

        for (const closestRoomK in closestRoomArray) { // go through each room until we find one we can use
            const closestRoomName = closestRoomArray[closestRoomK];
            for (const sK in spawnsMapping[closestRoomName]) {
                const defenders = _.filter(utilscreep.get_filtered_creeps('defender'), (creep) => creep.name in Memory.defenders[roomName].creeps);
                const defendersPer = defenders.length;
                if (defendersPer >= count) {
                    break;
                }
                const spawn = spawnsMapping[closestRoomName][sK];
                if (spawn.spawning) {
                    continue;
                }
                
                const newCreep = militaryDefender.create_creep(spawn, roomName);
                if (newCreep != null) { // if new creep created add to list
                    utilscreep.add_creep(newCreep);
                    Memory.defenders[roomName].creeps[newCreep.name] = true;
                    console.log('creepConstruction ' + roomName + ' has enemies, sending defenders')
                    return; // exit loop
                }
            }
        }
    },

    handle_build_no_spawns_defender(spawnsMapping) {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my)
                continue; // don't spawn defenders in rooms i own for now
            const data = military.getDefendersNeeded(roomName);
            if (data == null) // no data no enemies
                continue;
            // check if we have defenders
            const defenderCount = Object.keys(Memory.defenders[roomName].creeps).length;
            // for now lets just send 1
            if (defenderCount >= 1) {
                continue;
            }
            creepConstruction.handle_build_no_spawns_defender_helper(spawnsMapping, 1, roomName);
        }
    },

    handle_build_no_spawns_builder(spawnsMapping) {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            const spawnMaster = room.memory.spawnMaster;
            // check if the spawn exist, if it does then we dont need to send builders from another room
            if (spawnMaster != null && Game.spawns[spawnMaster]) {
                continue;
            }
            let closestRoomName = utilsRoom.getClosestRoomFromRoom(spawnsMapping, roomName);

            for (const sK in spawnsMapping[closestRoomName]) {
                const builders = utilscreep.get_filtered_creeps('builder');
                
                const spawn = spawnsMapping[closestRoomName][sK];
                if (spawn.spawning) {
                    continue;
                }
                // builders
                const roomBuilders = _.filter(builders, (creep) => creep.memory.home_room == roomName);
                const buildersPer = utils.notZero((roomBuilders.length / roleBuilder.get_harvest_count(Game.rooms[roomName])));
                if (buildersPer < 1) {
                    const newCreep = roleBuilder.create_creep(spawn, roomName);
                    if (newCreep != null) { // if new creep created add to list
                        utilscreep.add_creep(newCreep);
                    }
                    continue;
                }
            }
        }
    },

    handleBuildCanMiner(spawnsMapping) {
        // todo only after certain rcl do we want to start using can miners
        for (const roomName in Game.rooms) {
            //if (roomName != 'W7N7')
            //    continue;
            
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my)
                continue; // don't build can miners from rooms i don't own
            
            // now go through surronding rooms
            const exits = Game.map.describeExits(roomName);
            const array = [];
            for (const k in exits) {
                const oRoom = exits[k];
                // check if we already own room
                if (Game.rooms[oRoom] && Game.rooms[oRoom].controller && Game.rooms[oRoom].controller.my) {
                    continue;
                }
                // check if room is in our control
                if (Memory.rooms[oRoom].eCP || Memory.rooms[oRoom].type == common.roomMapping.RESERVED)
                    continue;
                // get sources for the room
                const sources = Memory.rooms[oRoom].sources;
                for (const id in sources) {
                    // now go through the sources
                    const source = sources[id];
                    if (!source.canCreep) {
                        // we can spawn a can miner
                        array.push([id, oRoom]);
                    }
                }
            }
            if (array.length == 0)
                continue;
            // go through the spawns
            for (const sK in spawnsMapping[roomName]) {
                if (array.length == 0)
                    break;
                const v = array.pop();
                const spawn = spawnsMapping[roomName][sK];
                if (spawn.spawning)
                    continue;
                const newCreep = roleCanHarvester.create_creep(spawn, v[0], v[1]);
                if (newCreep) {
                    const sources = Memory.rooms[v[1]].sources;
                    const source = sources[v[0]];
                    source.canCreep = newCreep.name;
                    utilscreep.add_creep(newCreep);
                    break;
                }
            }
        }
    },

    handleBuildTransport: function(spawnsMapping) {
        // handle building a transport to pick up energy from a can miner
        for (const roomName in Game.rooms) {
            //if (roomName != 'W7N7')
            //    continue;
            
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my)
                continue; // don't build can miners from rooms i don't own

            const exits = Game.map.describeExits(roomName);
            
            let total = utilscreep.get_role_home_filtered_creeps(roomName, common.creepRole.TRANSPORT).length;
            
            // get numbers of how many we want from neighboring rooms
            let want = transport.getTransportWant(exits);

            // now try figure out how many to spawn

            //const creepCount = utilscreep.getSourceCreepCount(id, oRoom);
            //if (creepCount >= 1) {
            //    continue;
            //}
            if (total >= want)
                continue;
            for (const sK in spawnsMapping[roomName]) {
                const spawn = spawnsMapping[roomName][sK];
                const newCreep = roleTransport.create_creep(spawn);
                if (newCreep) {
                    utilscreep.add_creep(newCreep);
                    total += 1;
                }
                if (total >= want)
                    break;
            }
        }
    }
}

module.exports = creepConstruction;