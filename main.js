const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');
const roleSmartHarvester = require('roles.smart_harvester');
const roleHauler = require('roles.hauler');
const roleScout = require('roles.scout');

const militaryClaimer = require('military.claimer');
const militaryDefender = require('military.defender');
const militaryTower = require('military.tower');
const military = require('military');

const construction = require('construction');

const utils = require('utils');
const utilscreep = require('utilscreep');
const utilsroom = require('utilsroom');

const pathFinder = require('pathFinder');

const profiler = require('screeps-profiler');

const common = require('common');

const os = require('os');

const expansion = require('expansion');

const creepConstruction = require('creepConstruction');

const creepMapping = {
    'harvester' : roleHarvester,
    'upgrader' : roleUpgrader,
    'builder' : roleBuilder,
    'repairer' : roleRepairer,
    'claimer' : militaryClaimer,
    'smartHarvester' : roleSmartHarvester,
    'defender' : militaryDefender,
    'hauler' : roleHauler,
    'scout' : roleScout
}

const profilerMapings = {
    'utils' : utils,
    'roleHarvester' : roleHarvester,
    'roleUpgrader' : roleUpgrader,
    'roleBuilder' : roleBuilder,
    'roleRepairer' : roleRepairer,
    'roleSmartHarvester' : roleSmartHarvester,
    'militaryDefender' : militaryDefender,
    'militaryClaimer' : militaryClaimer,
    'roleHauler' : roleHauler,
    'construction' : construction,
    'pathfinder' : pathFinder,
    'scout' : roleScout
}

//profiler.enable();
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
global.military = military;

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
    if (m.captureAuto == null) { // automatic flag
        m.captureAuto = {};
    }

    for (const k in Game.flags) {
        const v = Game.flags[k];
        if (!(v.pos.roomName in Memory.flags.energy) && k.startsWith('Energy')) {
            Memory.flags.energy[v.pos.roomName] = true;
        } else if (!(v.pos.roomName in Memory.flags.reserve) && k.startsWith('Reserve')) {
            Memory.flags.reserve[v.pos.roomName] = {};
        } else if (!(v.pos.roomName in Memory.flags.capture) && k.startsWith('Capture')) {
            Memory.flags.capture[v.pos.roomName] = {};
        }
    }

    // handle clearing out reserve creeps
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

    // delete flags that are no longer there
    for (const flagType in m) {
        if (flagType == 'captureAuto') {
            continue; // skip if capture auto as its self generated
        }

        const roomNames = m[flagType];
        for (const roomName in roomNames) {
            if (!(roomName in roomFlags) || !(flagType in roomFlags[roomName])) {
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
    let name = 'main-handle-creep-spawning'
    if (!os.existsThread(name)) {
        const f = function() {
            const mapping = utilscreep.getRoomToSpawnMapping();
            for (const roomName in Game.rooms) {
                creepConstruction.handle_build_order(mapping, roomName);
            }
        }
        os.newThread(name, f, 10);
    }

    name = 'main-handle-creep-spawning-scouts'
    if (!os.existsThread(name)) {
        const f = function() {
            const mapping = utilscreep.getRoomToSpawnMapping();
            creepConstruction.handle_build_no_spawns_scout(mapping);
        }
        os.newThread(name, f, 10);
    }

    name = 'main-handle-creep-spawning-defenders'
    if (!os.existsThread(name)) {
        const f = function() {
            const mapping = utilscreep.getRoomToSpawnMapping();
            creepConstruction.handle_build_no_spawns_defender(mapping);
        }
        os.newThread(name, f, 10);
    }

    name = 'main-handle-creep-spawning-builders'
    if (!os.existsThread(name)) {
        const f = function() {
            const mapping = utilscreep.getRoomToSpawnMapping();
            creepConstruction.handle_build_no_spawns_builder(mapping);
        }
        os.newThread(name, f, 10);
    }
}

function handleCreeps() {
    let name = 'main-handle-creep-running'
    if (!os.existsThread(name)) {
        const f = function() {
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
        }
        os.newThread(name, f, 1);
    }
}

function initialize() {
    let name = 'main-handle-flags'
    if (!os.existsThread(name)) {
        const f = function() {
            handleFlags();
        }
        os.newTimedThread(name, f, 10, 0, 10);
    }

    name = 'main-handle-expansion'
    if (!os.existsThread(name)) {
        const f = function() {
            expansion.generateThreads();
        }
        os.newTimedThread(name, f, 10, 0, 300);
    }
    
    utilscreep.clear_filtered_creeps();
    utilscreep.generateRoomToSpawnMapping();
}

function exportStats() {
    // Reset stats object
    const start = Game.cpu.getUsed();
    Memory.stats = {
      gcl: {},
      rooms: {},
      cpu: {},
    };
  
    Memory.stats.time = Game.time;
  
    // Collect room stats
    for (let roomName in Game.rooms) {
      let room = Game.rooms[roomName];
      let isMyRoom = (room.controller ? room.controller.my : false);
      if (isMyRoom) {
        let roomStats = Memory.stats.rooms[roomName] = {};
        roomStats.storageEnergy           = (room.storage ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0);
        roomStats.terminalEnergy          = (room.terminal ? room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) : 0);
        roomStats.energyAvailable         = room.energyAvailable;
        roomStats.energyCapacityAvailable = room.energyCapacityAvailable;
        roomStats.controllerProgress      = room.controller.progress;
        roomStats.controllerProgressTotal = room.controller.progressTotal;
        roomStats.controllerLevel         = room.controller.level;
      }
    }
  
    // Collect GCL stats
    Memory.stats.gcl.progress      = Game.gcl.progress;
    Memory.stats.gcl.progressTotal = Game.gcl.progressTotal;
    Memory.stats.gcl.level         = Game.gcl.level;
  
    // Collect CPU stats
    Memory.stats.cpu.bucket        = Game.cpu.bucket;
    Memory.stats.cpu.limit         = Game.cpu.limit;
    Memory.stats.cpu.used          = Game.cpu.getUsed();

    // metrics cpu usage
    Memory.stats.cpu.metricsUsed   = Game.cpu.getUsed() - start;
}

module.exports.loop = function () {
    
    profiler.wrap(function() {
        // iterate through flags and pull out details
        initialize();
        
        loopRooms();
        //return
        
        loopSpawns();
        
        handleCreeps();
        os.run();
        exportStats();
    })
}