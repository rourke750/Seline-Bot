const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');

const militaryScout = require('military.scout');

const construction = require('construction');

const utils = require('utils');

const profiler = require('screeps-profiler');

const creepMapping = {
    'harvester' : roleHarvester,
    'upgrader' : roleUpgrader,
    'builder' : roleBuilder,
    'repairer' : roleRepairer,
    'scout' : militaryScout
} 

profiler.enable();
//todo make each creep find the cloest energy first 
// todo make similar actors do same actions
//todo check if a creep is idle

function handle_build_order(spawn, harvesters, upgraders, builders, repairers, scouts) {
    // test code for logging
    // todo try get cords for coordinator in another room that i dont have vision using terrain scan
    //const flag = Game.flags['Capture']
    //console.log(flag.pos)
    
    // build priority:
    // 1. always harvesters, 2 at least 1 upgrader, 3 repairer, 4 builder
    const roomHarvesters = _.filter(harvesters, (creep) => creep.memory.home_room === spawn.room.name);
    if (roomHarvesters.length < 8) {
        roleHarvester.create_creep(spawn);
    } else {
        const roomUpgraders = _.filter(upgraders, (creep) => creep.room.name == spawn.room.name);
        const roomBuilders = _.filter(builders, (creep) => creep.room.name == spawn.room.name);
        const roomRepairers = _.filter(repairers, (creep) => creep.room.name == spawn.room.name);
        if (roomUpgraders.length == 0) {
            roleUpgrader.create_creep(spawn);
            return;
        }
        // Now we want to see what percent of everything else is available and spawn accordingly
        const upgraderPer = roomUpgraders.length / 12;
        const buildersPer = utils.notZero((roomBuilders.length / roleBuilder.get_harvest_count(spawn.room)));
        const repairerPer = utils.notZero((roomRepairers.length / roleRepairer.get_harvest_count(spawn.room)));
        const scountPerr = scouts.length / 1;
        
        const nextCreate = [
            [upgraderPer, roleUpgrader],
            [buildersPer, roleBuilder],
            [repairerPer, roleRepairer]//,
//            [scountPerr, militaryScout]
        ];
        nextCreate.sort(function(a, b) {return a[0] - b[0]});
        //console.log('room ' + spawn.room.name+' num '+repairerPer + ' exist ' + roomRepairers.length + ' want ' + roleRepairer.get_harvest_count(spawn.room))
        //console.log(roleBuilder.get_harvest_count(spawn.room), + ' ' + buildersPer)
        if (nextCreate[0][0] < 1) {
            nextCreate[0][1].create_creep(spawn);
        }
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
        if (!(k in Memory.flags)) {
            if (k.startsWith('Energy')) {
                // todo come up with something clever here so we dont have to iterate so much
                // we found a destination
                Memory.flags.energy = v.pos;
            }
        }
    }
}

module.exports.loop = function () {
    
    profiler.wrap(function() {
        // iterate through flags and pull out details
        handleFlags();
        
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
        const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
        const builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
        const repairers = _.filter(Game.creeps, (creep) => creep.memory.role == 'repairer');
        const scouts = _.filter(Game.creeps, (creep) => creep.memory.role == 'scout');
        
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
                
                let totalRequest = 0;
                for (const c in room.memory.sources[source.id].creeps) {
                    const v = room.memory.sources[source.id].creeps[c];
                    if (Game.time > v.lastTicked + 1) {
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
        
        for (const name in Game.spawns) {
            const spawn = Game.spawns[name];
            
            //todo come up with a build order in how it should work
            //todo come up with how we should build the units based on energy available
            //todo calculate how many creeps per thing are needed per energy and distance
            //todo come up with way to figure out if builders are needed and how many
            //todo for sources figure out ticks to regeneration who is traveling and then do stuff based on it ie go to others
            
            handle_build_order(spawn, harvesters, upgraders, builders, repairers, scouts);
            
            if (spawn.spawning) { 
                var spawningCreep = Game.creeps[spawn.spawning.name];
                spawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    spawn.pos.x + 1, 
                    spawn.pos.y, 
                    {align: 'left', opacity: 0.8});
            }
        }
        
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