const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');
const roleSmartHarvester = require('roles.smart_harvester');

const militaryScout = require('military.scout');

const construction = require('construction');

const utils = require('utils');

const profiler = require('screeps-profiler');

const creepMapping = {
    'harvester' : roleHarvester,
    'upgrader' : roleUpgrader,
    'builder' : roleBuilder,
    'repairer' : roleRepairer,
    'scout' : militaryScout,
    'smartHarvester' : roleSmartHarvester 
} 

profiler.enable();
utils.move_to = profiler.registerFN(utils.move_to, 'utils.move_to');
utils.harvest_source = profiler.registerFN(utils.harvest_source, 'utils.harvest_source')
utils.find_source = profiler.registerFN(utils.find_source, 'utils.find_source')

//todo make each creep find the cloest energy first 
// todo make similar actors do same actions
//todo check if a creep is idle

function handle_build_order(spawn, harvesters, upgraders, builders, repairers, scouts, smartHarvesters) {
    // test code for logging
    // todo try get cords for coordinator in another room that i dont have vision using terrain scan
    //const flag = Game.flags['Capture']
    //console.log(flag.pos)
    
    // build priority:
    // 1. always harvesters, 2 at least 1 upgrader, 3 repairer, 4 builder
    const roomHarvesters = _.filter(harvesters, (creep) => creep.memory.home_room === spawn.room.name);
    if (roomHarvesters.length < 8) {
        roleHarvester.create_creep(spawn);
        const text = `harvesters ${roomHarvesters.length}`;
        spawn.room.visual.text(
            text,
            spawn.pos.x, 
            spawn.pos.y + 2, 
            {align: 'center', opacity: 0.8});
    } else {
        const roomUpgraders = _.filter(upgraders, (creep) => creep.memory.home_room == spawn.room.name);
        const roomBuilders = _.filter(builders, (creep) => creep.room.name == spawn.room.name);
        const roomRepairers = _.filter(repairers, (creep) => creep.room.name == spawn.room.name);
        const roomSmartHarvesters = _.filter(smartHarvesters, (creep) => creep.room.name == spawn.room.name);
        if (roomUpgraders.length == 0) {
            roleUpgrader.create_creep(spawn);
            return;
        }
        // Now we want to see what percent of everything else is available and spawn accordingly
        const upgraderPer = roomUpgraders.length / 12;
        const buildersPer = utils.notZero((roomBuilders.length / roleBuilder.get_harvest_count(spawn.room)));
        const repairerPer = utils.notZero((roomRepairers.length / roleRepairer.get_harvest_count(spawn.room)));
        const scountPerr = scouts.length / 1;
        const smartHarvesterPerr = utils.notZero((roomSmartHarvesters.length / roleSmartHarvester.get_harvest_count(spawn.room)));
        
        const nextCreate = [
            [upgraderPer, roleUpgrader],
            [buildersPer, roleBuilder],
            [repairerPer, roleRepairer]//,
//            [scountPerr, militaryScout]
//            [smartHarvesterPerr, roleSmartHarvester]
        ];
        nextCreate.sort(function(a, b) {return a[0] - b[0]});
        if (nextCreate[0][0] < 1) {
            nextCreate[0][1].create_creep(spawn);
        }
        
        const text = `up ${upgraderPer.toFixed(2)} build ${buildersPer} rep ${repairerPer}`;
        spawn.room.visual.text(
            text,
            spawn.pos.x, 
            spawn.pos.y + 2, 
            {align: 'center', opacity: 0.8});
    }
}

function handleFlags() {
    if (Memory.flags == null) {
        Memory['flags'] = {};
    }
    if (Memory.flags.energy == null) {
        Memory.flags['energy'] = {};
    }
    for (const k in Game.flags) {
        const v = Game.flags[k];
        if (k.startsWith('Energy')) {
            Memory.flags.energy[v.pos.roomName] = true;
        }
    }
    //todo remove flags that are no longer there
}

function loopRooms() {
    for (var name in Game.rooms) {
        const room = Game.rooms[name];
        for (var role in creepMapping) {
            creepMapping[role].upgrade(room);
        }
        
        const sources = room.find(FIND_SOURCES);
        for (var id in sources) {
            const source = sources[id];
            construction.build_roads_from_source(source);
            construction.build_container_near_sources(source);
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
                room.memory.sources[source.id].maxCreeps = {positions: positions, maxCount: count};
            }
            
            let totalRequest = 0;
            for (const c in room.memory.sources[source.id].creeps) {
                const v = room.memory.sources[source.id].creeps[c];
                if (v.lastTicked == null) {
                    delete room.memory.sources[source.id].creeps[c];
                } else if (Game.time > v.lastTicked + 3) {
                    if (room.memory.sources[source.id].creeps[c].claimedPos != null) 
                        room.memory.sources[source.id].maxCreeps.positions.push(room.memory.sources[source.id].creeps[c].claimedPos);
                    delete room.memory.sources[source.id].creeps[c];
                } else {
                    if (Game.creeps[c] != undefined) {
                        totalRequest += Game.creeps[c].store.getFreeCapacity();
                    }
                }
            }
            room.memory.sources[source.id].totalEnergyWant = totalRequest;
        }
        construction.build_extensions(room);
        construction.remove_old_roads(room);
    }
}

function loopSpawns() {
    const harvesters = utils.get_filtered_creeps('harvester')
    const upgraders = utils.get_filtered_creeps('upgrader');
    const builders = utils.get_filtered_creeps('builder');
    const repairers = utils.get_filtered_creeps('repairer');
    const scouts = utils.get_filtered_creeps('scout');
    const smartHarvesters = utils.get_filtered_creeps('smartHarvester');
    for (const name in Game.spawns) {
        const spawn = Game.spawns[name];
        
        //todo come up with a build order in how it should work
        //todo come up with how we should build the units based on energy available
        //todo calculate how many creeps per thing are needed per energy and distance
        //todo come up with way to figure out if builders are needed and how many
        //todo for sources figure out ticks to regeneration who is traveling and then do stuff based on it ie go to others
        
        handle_build_order(spawn, harvesters, upgraders, builders, repairers, scouts, smartHarvesters);
        
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

function initialize() {
    handleFlags();
    utils.clear_filtered_creeps()
}

module.exports.loop = function () {
    
    profiler.wrap(function() {
        // iterate through flags and pull out details
        initialize()
        
        loopRooms();
        
        loopSpawns();
        
        for(var i in Memory.creeps) {
            if(!Game.creeps[i]) {
                delete Memory.creeps[i];
            }
        }
        
        for(var name in Game.creeps) {
            var creep = Game.creeps[name];
            var role = creep.memory.role;
            creepMapping[role].run(creep);
        }
    })
}