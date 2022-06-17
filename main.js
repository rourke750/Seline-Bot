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
const utilsroom = require('utilsroom');

const pathFinder = require('pathFinder');

const profiler = require('screeps-profiler');

const common = require('common');

const os = require('os');

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
global.os = os;

//os.newThread('test1', function(){console.log('test1')},3)
//os.newThread('test2', function(){console.log('test2')},4)
//os.newThread('test3', function(){console.log('test3')},7)
//os.newThread('test4', function(){console.log('test4')},0)

//todo make each creep find the cloest energy first 
// todo make similar actors do same actions
//todo check if a creep is idle

function handle_build_order(spawnsMapping, roomName) { //todo remove not used params
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
            const roomHaulers = utilscreep.get_role_home_filtered_creeps(roomName, 'hauler');
            const scouts = utilscreep.get_filtered_creeps('scout');
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
        const builders = utilscreep.get_filtered_creeps('builder');
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

function loopRooms() {
    for (var name in Game.rooms) {
        const room = Game.rooms[name];
        utilsroom.constructRooms(room);
        utilsroom.upgradeRooms(room);
        militaryTower.run(room);

        utilsroom.handleSources(room);
    }
}

function loopSpawns() {
    const mapping = {};
    for (const k in Game.spawns) {
        const spawn = Game.spawns[k];
        if (!(spawn.room.name in mapping)) {
            mapping[spawn.room.name] = [];
        }
        mapping[spawn.room.name].push(spawn);
    }
    for (const name in Game.rooms) {
        handle_build_order(mapping, name);
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
        os.run();
    })
}