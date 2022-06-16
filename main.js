const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');
const roleSmartHarvester = require('roles.smart_harvester');
const roleHauler = require('roles.hauler');

const militaryScout = require('military.scout');
const militaryDefender = require('military.defender');
const militaryTower = require('military.tower');

const construction = require('construction');

const utils = require('utils');
const utilscreep = require('utilscreep');
const pathFinder = require('pathFinder');

const profiler = require('screeps-profiler');

const creepMapping = {
    'harvester' : roleHarvester,
    'upgrader' : roleUpgrader,
    'builder' : roleBuilder,
    'repairer' : roleRepairer,
    'scout' : militaryScout,
    'smartHarvester' : roleSmartHarvester,
    'defender' : militaryDefender,
    'hauler' : roleHauler
}

const profilerMapings = {
    'utils' : utils,
    'roleHarvester' : roleHarvester,
    'roleUpgrader' : roleUpgrader,
    'roleBuilder' : roleBuilder,
    'roleRepairer' : roleRepairer,
    'roleSmartHarvester' : roleSmartHarvester,
    'militaryDefender' : militaryDefender,
    'militaryScout' : militaryScout,
    'roleHauler' : roleHauler,
    'construction' : construction,
    'pathfinder' : pathFinder
}

profiler.enable();
//console.log(JSON.stringify(utils.valueOf()))
for (const pMap in profilerMapings) {
    for (const k in profilerMapings[pMap]) {
        if (typeof profilerMapings[pMap][k] == 'function') {
            profilerMapings[pMap][k] = profiler.registerFN(profilerMapings[pMap][k], `${pMap}.${k}`);
        }
    }
}

global.utils = utils;
global.pathFinder = pathFinder;

//todo make each creep find the cloest energy first 
// todo make similar actors do same actions
//todo check if a creep is idle

function handle_build_order(spawnsMapping, roomName, harvesters, upgraders, builders, repairers, scouts, smartHarvesters, haulers) {
    // test code for logging
    // todo try get cords for coordinator in another room that i dont have vision using terrain scan
    //const flag = Game.flags['Capture']
    //console.log(flag.pos)
    
    // build priority:
    // 1. always harvesters, 2 at least 1 upgrader, 3 repairer, 4 builder
    const spawns = spawnsMapping[roomName]
    for (const sK in spawns) {
        const spawn = spawns[sK];
        const roomHarvesters = utilscreep.get_role_home_filtered_creeps(roomName, 'harvester');
        if (roomHarvesters.length < 4) {
            roleHarvester.create_creep(spawn);
            const text = `harvesters ${roomHarvesters.length}`;
            spawn.room.visual.text(
                text,
                spawn.pos.x, 
                spawn.pos.y + 2, 
                {align: 'center', opacity: 0.8});
        } else {
            //todo move below code where it filters on home_room to utils package where we can cache per tick
            // todo doesnt make sense that we are doing this for every spawn remove
            const roomUpgraders = utilscreep.get_role_home_filtered_creeps(roomName, 'upgrader');
            const roomBuilders = utilscreep.get_role_home_filtered_creeps(roomName, 'builder');
            const roomRepairers = utilscreep.get_role_home_filtered_creeps(roomName, 'repairer');
            const roomSmartHarvesters = utilscreep.get_role_home_filtered_creeps(roomName, 'smartHarvester');
            const roomHaulers = utilscreep.get_role_home_filtered_creeps(roomName, 'hauler');;
            if (roomUpgraders.length == 0) {
                roleUpgrader.create_creep(spawn);
                return;
            }
            // Now we want to see what percent of everything else is available and spawn accordingly
            const upgraderPer = utils.notZero((roomUpgraders.length / roleUpgrader.get_harvest_count(spawn.room)));
            const buildersPer = utils.notZero((roomBuilders.length / roleBuilder.get_harvest_count(spawn.room)));
            const repairerPer = utils.notZero((roomRepairers.length / roleRepairer.get_harvest_count(spawn.room)));
            const scountPerr = utils.notZero((scouts.length / utils.get_scout_count()));
            const smartHarvesterPerr = utils.notZero((roomSmartHarvesters.length / roleSmartHarvester.get_harvest_count(spawn.room)));
            const haulersPerr = utils.notZero((roomHaulers.length / roleHauler.get_harvest_count(spawn.room)));
            
            const nextCreate = [
                [upgraderPer, roleUpgrader],
                [buildersPer, roleBuilder],
                [repairerPer, roleRepairer],
                [scountPerr, militaryScout],
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
            
            const text = `up ${upgraderPer.toFixed(2)} build ${buildersPer} rep ${repairerPer}`;
            spawn.room.visual.text(
                text,
                spawn.pos.x, 
                spawn.pos.y + 2, 
                {align: 'center', opacity: 0.8});
            if (spawn.spawning) { 
                var spawningCreep = Game.creeps[spawn.spawning.name];
                spawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    spawn.pos.x + 1, 
                    spawn.pos.y, 
                    {align: 'left', opacity: 0.8});
            }
        }
    }
    //todo below is code for spawning to rooms from other rooms, 
    // if we have no spawns
    if (spawns == null) {
        let closest = 9999999;
        let closestRoomName = null;
        for (const otherRoomName in spawnsMapping) {
            const d = Game.map.getRoomLinearDistance(roomName, otherRoomName);
            if (d < closest) {
                closest = d;
                closestRoomName = otherRoomName;
            }
        }
        for (const sK in spawnsMapping[closestRoomName]) {
            const spawn = spawnsMapping[closestRoomName][sK];
            if (spawn.spawning) {
                continue;
            }
            const roomBuilders = _.filter(builders, (creep) => creep.memory.home_room == roomName);
            const buildersPer = utils.notZero((roomBuilders.length / roleBuilder.get_harvest_count(Game.rooms[roomName])));
            if (buildersPer < 1) {
                roleBuilder.create_creep(spawn, roomName);
            }
        }
    }
}

function handleFlags() {
    const m = Memory['flags'];
    if (m == null) {
        Memory['flags'] = {}
        m = Memory['flags'];
    }
    
    if (m.energy == null) {
        m.energy = {};
    }
    if (m.reserve == null) {
        m.reserve = {};
    }
    if (m.capture == null) {
        m.capture = {};
    }

    for (const k in Game.flags) {
        const v = Game.flags[k];
        if (!(v.pos.roomName in Memory.flags.energy) && k.startsWith('Energy')) {
            Memory.flags.energy[v.pos.roomName] = {};
        } else if (!(v.pos.roomName in Memory.flags.reserve) && k.startsWith('Reserve')) {
            Memory.flags.reserve[v.pos.roomName] = {};
        } else if (!(v.pos.roomName in Memory.flags.capture) && k.startsWith('Capture')) {
            Memory.flags.capture[v.pos.roomName] = {};
        }
    }
    for (const flagTypeK in m) {
        for (const arrayPos in m[flagTypeK]) {
            const flagRooms = m[flagTypeK][arrayPos];
            for (const creepPos in flagRooms) {
                if (!(creepPos in Game.creeps)) {
                    delete flagRooms[creepPos];
                }
            }
        }
    }
    //todo remove flags that are no longer there
    const roomFlags = {};
    for (const fN in Game.flags) {
        const flag = Game.flags[fN];

        if (!(flag.pos.roomName in roomFlags)) {
            roomFlags[flag.pos.roomName] = {};
        }

        let n;
        if (flag.name.startsWith('Energy')) {
            n = 'energy';
        } else if (flag.name.startsWith('Reserve')) {
            n = 'reserve';
        } else if (flag.name.startsWith('Capture')) {
            n = 'capture';
        }
        roomFlags[flag.pos.roomName][n] = true;
    }

    for (const flagType in m){
        const roomNames = m[flagType];
        for (const roomName in roomNames) {
            if (!(roomName in roomFlags) || !(flagType in roomFlags[roomName])) {
                // err fucking figure out yourself
                console.log(JSON.stringify(roomFlags))
                delete m[flagType][roomName];
            }
        }
    }
}

function constructRooms(room) {
    construction.build_missing_spawn(room);
    if ((Game.time + 20) % 1000 == 0) {
        construction.buildSpawnCenter(room); // hanldes building the spawns
        construction.build_extensions(room); // hanldes building the extensions
         // handles building the roads to extensions, towers, link near spawn, other center piece stuff
        construction.buildAuxNearSpawn(room);
        construction.buildRoadsFromMasterSpawnToExits(room);
        construction.buildRoadFromMasterSpawnToSources(room);
        construction.buildRoadsFromMasterSpawnToController(room);
    } else if ((Game.time + 30) % 1000 == 0) {
        construction.remove_old_roads(room);
    } else if ((Game.time + 40) % 100 == 0) {
        pathFinder.build_cost_matrix(room.name, true);
    }
}

function loopRooms() {
    for (var name in Game.rooms) {
        const room = Game.rooms[name];
        constructRooms(room);
        for (var role in creepMapping) {
            if (room.energyCapacityAvailable == 0) {
                continue;
            }
            creepMapping[role].upgrade(room);
        }
        militaryTower.run(room);

        const sources = room.find(FIND_SOURCES);
        for (var id in sources) {
            const source = sources[id];
            construction.build_link_near_sources(source);

            // set sources energy request to 0
            if (room.memory.sources == null) {
                room.memory.sources = {};
            }
            if (!(source.id in room.memory.sources)) {
                room.memory.sources[source.id] = {};
            }
            if (room.memory.sources[source.id].creeps == null) {
                room.memory.sources[source.id].creeps = {};
            }
            
            if (room.controller == undefined || !room.controller.my) {
                // Let's go ahead and scout this room
                room.memory.sources[source.id].x = source.pos.x;
                room.memory.sources[source.id].y = source.pos.y;
            }

            if (room.memory.sources[source.id].maxCreeps == null) {
                // let's try find the max creeps we can support
                const a = room.lookAtArea(source.pos.y-1, source.pos.x-1, source.pos.y+1, source.pos.x+1, true);
                count = 0
                positions = [];
                for (const aK in a) {
                    const aV = a[aK];
                    if (aV.type == 'terrain' && (aV.terrain == 'plain' || aV.terrain == 'swamp')) {
                        count += 1;
                        positions.push([aV.x, aV.y])
                    }
                }
                room.memory.sources[source.id].maxCreeps = {positions: positions, maxCount: count, occupied: new Array(count).fill(0)};
            }
            
            
            if (room.memory.sources[source.id].smartCreep != null &&
                Game.creeps[room.memory.sources[source.id].smartCreep] == null) {
                room.memory.sources[source.id].smartCreep = null
            }

            let totalRequest = 0;
            for (const c in room.memory.sources[source.id].creeps) {
                const v = room.memory.sources[source.id].creeps[c];
                if (v.lastTicked == null) {
                    room.memory.sources[source.id].maxCreeps.occupied[v.maxCreepsIndexPosition] = 0;
                    delete room.memory.sources[source.id].creeps[c];
                } else if (Game.time > v.lastTicked + 3) {
                    room.memory.sources[source.id].maxCreeps.occupied[v.maxCreepsIndexPosition] = 0;
                    delete room.memory.sources[source.id].creeps[c];
                } else {
                    if (Game.creeps[c] != undefined) {
                        totalRequest += Game.creeps[c].store.getFreeCapacity();
                        // let's go ahead and set this to 1 incase we had cleared it earlier or something
                        room.memory.sources[source.id].maxCreeps.occupied[v.maxCreepsIndexPosition] = 1;
                    }
                }
            }
            room.memory.sources[source.id].totalEnergyWant = totalRequest;
        }
    }
}

function loopSpawns() {
    const harvesters = utilscreep.get_filtered_creeps('harvester')
    const upgraders = utilscreep.get_filtered_creeps('upgrader');
    const builders = utilscreep.get_filtered_creeps('builder');
    const repairers = utilscreep.get_filtered_creeps('repairer');
    const scouts = utilscreep.get_filtered_creeps('scout');
    const smartHarvesters = utilscreep.get_filtered_creeps('smartHarvester');
    const haulers = utilscreep.get_filtered_creeps('hauler');
    const mapping = {};
    for (const k in Game.spawns) {
        const spawn = Game.spawns[k];
        if (!(spawn.room.name in mapping)) {
            mapping[spawn.room.name] = [];
        }
        mapping[spawn.room.name].push(spawn);
    }
    for (const name in Game.rooms) {
        handle_build_order(mapping, name, harvesters, upgraders, builders, repairers, scouts, smartHarvesters, haulers);
    }
}

function initialize() {
    handleFlags();
    utilscreep.clear_filtered_creeps()
}

module.exports.loop = function () {
    
    profiler.wrap(function() {
        // iterate through flags and pull out details
        initialize();
        
        loopRooms();
        //return
        
        loopSpawns();
        
        for(var i in Memory.creeps) {
            if(!Game.creeps[i]) {
                delete Memory.creeps[i];
            }
        }
        
        for(var name in Game.creeps) {
            var creep = Game.creeps[name];
            var role = creep.memory.role;
            if (role == null || role == undefined) {
                console.log(creep.name + ' ' + role + ' has an undefined role? ' + creep.pos);
                continue;
            }
            creepMapping[role].run(creep);
        }
    })
}