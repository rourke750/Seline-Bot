const utilscreep = require('utilscreep');
const utilsRoom = require('utilsroom');

const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');
const roleSmartHarvester = require('roles.smart_harvester');
const roleHauler = require('roles.hauler');
const roleScout = require('roles.scout');

const militaryClaimer = require('military.claimer');
const militaryDefender = require('military.defender');

const military = require('military');

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
            } else if (roomHarvesters.length < 4) {
                const newCreep = roleHarvester.create_creep(spawn); 
                if (newCreep != null) { // if new creep created add to list
                    utilscreep.add_creep(newCreep);
                }
            } else {
                //todo move below code where it filters on home_room to utils package where we can cache per tick
                // todo doesnt make sense that we are doing this for every spawn remove
                const roomUpgraders = utilscreep.get_role_home_filtered_creeps(roomName, 'upgrader');
                const roomBuilders = utilscreep.get_role_home_filtered_creeps(roomName, 'builder');
                const roomRepairers = utilscreep.get_role_home_filtered_creeps(roomName, 'repairer');
                const claimers = utilscreep.get_filtered_creeps('claimer');
                if (roomUpgraders.length == 0) {
                    roleUpgrader.create_creep(spawn);
                    return;
                }
                // Now we want to see what percent of everything else is available and spawn accordingly
                const upgraderPer = utils.notZero((roomUpgraders.length / roleUpgrader.get_harvest_count(spawn.room)));
                const buildersPer = utils.notZero((roomBuilders.length / roleBuilder.get_harvest_count(spawn.room)));
                const repairerPer = utils.notZero((roomRepairers.length / roleRepairer.get_harvest_count(spawn.room)));
                const claimersPer = utils.notZero((claimers.length / utils.get_claimer_count()));
                const smartHarvesterPerr = utils.notZero((roomSmartHarvesters.length / smartCount));
                const haulersPerr = utils.notZero((roomHaulers.length / roleHauler.get_harvest_count(spawn.room)));
                
                const nextCreate = [
                    [upgraderPer, roleUpgrader],
                    [buildersPer, roleBuilder],
                    [repairerPer, roleRepairer],
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

        const roomHarvesters = utils.notZero((roomHarvesterss.length / roleHarvester.get_harvest_count(Game.rooms[roomName])));
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
        let closestRoomName = utilsRoom.getClosestRoomFromRoom(spawnsMapping, roomName);

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
    }
}

module.exports = creepConstruction;