const utils = require('utils');
const common = require('common');
const pathFinder = require('pathFinder');

const obsticalD = {};
for (ob in OBSTACLE_OBJECT_TYPES) {
    obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
}
 
var construction = {

    doesConstructionExistAndCantBuild: function(room, pos) { // return true if there is already a struct there or a construction site
        const struct = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
        const c = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);

        return (c.length > 0 || (struct.length > 0 && struct[0].structureType in obsticalD))
    },

    // build a link near the spawns and roads that are needed
    buildAuxNearSpawn: function(room) {
        // we want to build a link and roads around the spawn
        if (room.memory.spawnMaster == null) {
            return;
        }
        const linkLoc = room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+2);
        linkLoc.createConstructionSite(STRUCTURE_LINK);

        const structs = linkLoc.lookFor(LOOK_STRUCTURES);
        let link_id = null;
        for (const i in structs) {
            const v = structs[i];
            if (v.structureType == 'link') {
                link_id = v.id;
                break;
            }
        }
        if (link_id != null) {
            room.memory.masterLink = link_id;
        }

        // try build roads
        // we want a diagonal up each point
        for (let i = 1; i <= 7; i += 2) {
            let positions = utils.buildLineDirection(room.memory.spawnMasterX, room.memory.spawnMasterY+1, i, 4)
            for (const ii in positions) {
                const v = positions[ii];
                if (this.doesConstructionExistAndCantBuild(room, v)) // if we are already constructing we do not want to call this method
                    continue;
                room.getPositionAt(v[0], v[1]).createConstructionSite(STRUCTURE_ROAD);
            }
        }
        room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+1).createConstructionSite(STRUCTURE_ROAD);

        // build roads around spawns
        const posOffset = [[0, 3], [-1, -2], [0, -1], [1, 4]]
        for (let i = 1; i <= 7; i += 2) {
            const pOff = posOffset[parseInt(i/2)]
            let positions = utils.buildLineDirection(room.memory.spawnMasterX + pOff[0], room.memory.spawnMasterY+pOff[1], i, 2)
            for (const ii in positions) {
                const v = positions[ii];
                if (this.doesConstructionExistAndCantBuild(room, v))
                    continue;
                room.getPositionAt(v[0], v[1]).createConstructionSite(STRUCTURE_ROAD);
            }
            //new RoomVisual(room.name).poly(positions, {stroke: '#000000', strokeWidth: .8, 
            //    opacity: .9});
        }

        // build defense towers

        // build storage container
        const containerLoc = room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+1);
        containerLoc.createConstructionSite(STRUCTURE_CONTAINER);

        // build main storage
    },

    // This function handles building the spawn
    buildSpawnCenter: function(room) {
        let maxSpawns = 1;
        if (!room.controller.my) {
            return;
        } else if (room.controller.level == 7) {
            maxSpawns = 2;
        } else if (room.controller.level == 8) {
            maxSpawns = 3;
        }

        const spawns = [];
        for (const k in Game.spawns) {
            const spawn = Game.spawns[k];
            if (spawn.room.name != room.name) {
                continue;
            }
            spawns.push(spawn);
        }

        if (spawns.length == 1 && room.memory.spawnMaster == null) {
            room.memory.spawnMaster = spawns[0].name;
            room.memory.spawnMasterX = spawns[0].pos.x;
            room.memory.spawnMasterY = spawns[0].pos.y;
        }
        
        if (spawns.length >= maxSpawns) {
            // we have all our spawns
            return;
        }
        // check if the master spawn is still there, if not rebuild it 
        if (room.memory.spawnMaster != null && !Game.spawns[room.memory.spawnMaster]) {
            // we are missing the master spawn rebuild it
            const n = `${room.name}-1`;
            room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY).createConstructionSite(STRUCTURE_SPAWN, n);
            room.memory.spawnMaster = n;
        }
        const m = Game.spawns[room.memory.spawnMaster];
        if (m == null) {
            return
        }
        // check for bottom left spawn if we can build it

        let secondLocation = room.getPositionAt(m.pos.x-1, m.pos.y+1);
        if (!this.find_spawns_at_pos(room, secondLocation)) { // didnt find a spawn lets build it
            const n = `${room.name}-2`;
            secondLocation.createConstructionSite(STRUCTURE_SPAWN, n);
        }
        // check for bottom right spawn if we can build it
        secondLocation = room.getPositionAt(m.pos.x+1, m.pos.y+1);
        if (!this.find_spawns_at_pos(room, secondLocation)) { // didnt find a spawn lets build it
            const n = `${room.name}-3`;
            secondLocation.createConstructionSite(STRUCTURE_SPAWN, n);
        }
    },

    find_spawns_at_pos: function(room, pos) {
        const secondLocation = room.lookAt(pos);
        for (const sL in secondLocation) {
            const sV = secondLocation[sL];
            if (sV.type == LOOK_STRUCTURES && sV.structure.structureType == 'spawn') {
                return true;
            } else if (sV.type == LOOK_CONSTRUCTION_SITES && sV.constructionSite.structureType == 'spawn') {
                return true;
            }
        }
        return false;
    },
    
    build_link_near_sources: function(source) {
        /* goal of this method is to build a link that will match up with with a source and is close to the spawn, 
        then haulers can carry energy to where its needed
        */
        /*
        for (const f in Game.flags) {
            if (Game.flags[f].pos.roomName == 'W3N7') {
                Game.flags[f].remove()
            }
        }
        */
        //pos.createFlag();
                
        if (!((Game.time + 40) % 1000 == 0 && source.room.controller.level >= 6)) {
            return
        }
        
        if (Memory.rooms[source.room.name].sources == null || Memory.rooms[source.room.name].sources == undefined) {
            Memory.rooms[source.room.name].sources = {};
        }
        
        if (!(source.id in Memory.rooms[source.room.name].sources)) {
            Memory.rooms[source.room.name].sources[source.id] = {}
        }
        
        // check the building if its finished
        const structs = source.room.lookForAt(
            LOOK_STRUCTURES, Memory.rooms[source.room.name].sources[source.id].container_x, 
            Memory.rooms[source.room.name].sources[source.id].container_y).map(f => f.structureType);
        var found = false
        for (const s in structs) {
            if (structs[s] == STRUCTURE_LINK) {
                found = true;
                break;
            }
        }
        Memory.rooms[source.room.name].sources[source.id].finished = found;
        if (found)
            return;
        
        //todo change the above logic where only if it is found does the below code not run
        
        const spawns = source.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) && 
                            structure.room.name == source.room.name;
                        }
                    });
        if (spawns == null) {
            console.log('why is spawns null ' + source.room.name + ' ' + source.id);
            return;
        }
        
        const mem = Memory.rooms[source.room.name].sources[source.id];

        var pos;
        if (mem.container_x == null || mem.container_y == null) {
            const path = source.pos.findPathTo(spawns[0], utils.movement_options);
            pos = new RoomPosition(path[1].x, path[1].y, source.room.name);
            mem.container_x = pos.x;
            mem.container_y = pos.y;
        } else {
            pos = new RoomPosition(mem.container_x, mem.container_y, source.room.name);
        }
        
        const conErr = pos.createConstructionSite(STRUCTURE_LINK)
        if (conErr != 0) {
            console.log('failed to create construction site for STRUCTURE_LINK ' + conErr);
            // it shouldnt create one without x, y being set as well.
            return;
        }
        mem.finished = false;
    },
    
    get_available_extentions_build: function(room) {
        const extensions = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_EXTENSION });
        const in_progress = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: (s) => s.structureType == STRUCTURE_EXTENSION })
        
        var extensionCount;
        switch (room.controller.level) {
        case 2:
            extensionCount = 5;
            break;
        case 3:
            extensionCount = 10;
            break;
        default:
            extensionCount = (room.controller.level - 2) * 10;
            break;
        }
        return extensionCount - extensions.length - in_progress.length;
    },
    
    build_exensions_success: function(results) {
        if (results == ERR_INVALID_TARGET) {
            console.log('error spawning extension attempting new location');
        } else if (results == OK) {
            console.log('found valid extension location');
            return true;
        } else {
            console.log('Unknown location with error ' + results);
        }
        return false
    },

    get_extension_positions: function(x, y, xDir, yDir) {
        const positions = [];
        for (var xx = 1; xx < 4; xx++) {
            positions.push([x + (xx * xDir), y - (xx * yDir)])
            positions.push([x + (xx * xDir), y - (xx * yDir) - (1 * yDir)])
        }
        positions.push([x + (4* xDir), y - (4 *yDir)])
        positions.push([x + (5* xDir), y - (4 *yDir)])
        positions.push([x + (5* xDir), y - (3 *yDir)])
        for (var xx = 4; xx >= 2; xx--) {
            positions.push([x + (xx * xDir) + (1*xDir), y - (xx * yDir) + (2*yDir)])
            positions.push([x + (xx * xDir), y - (xx * yDir) + (2*yDir)])
        }
        return positions;
    },
    
    build_extensions: function(room) {

        if (!room.controller.my)
            return;

        // todo build that cool design i saw 

        //todo use flag to premap how it will look
        var to_build = this.get_available_extentions_build(room);
        if (to_build == 0) {
            return;
        }
        const x = room.memory.spawnMasterX;
        const y = room.memory.spawnMasterY;
        
        const positions = [];
        positions.push(...this.get_extension_positions(x, y, 1, 1))
        positions.push(...this.get_extension_positions(x, y+2, 1, -1))
        positions.push(...this.get_extension_positions(x, y, -1, 1))
        positions.push(...this.get_extension_positions(x, y+2, -1, -1))
        for (var i = 0; i < positions.length; i++) {
            var results = room.createConstructionSite(positions[i][0], positions[i][1], STRUCTURE_EXTENSION);
            if (results == 0) {
                to_build--;
            }
            if (to_build == 0) 
                break
        }
        //new RoomVisual(room.name).poly(positions, {stroke: '#fff', strokeWidth: .15,
          //      opacity: .2, lineStyle: 'dashed'});
    },

    buildRoadFromMasterSpawnToSources: function(room) {
        if (room.memory.spawnMaster == null || !room.controller.my) {
            return;
        }
        const startPosition = {pos: room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), room: room};
        const sources = room.find(FIND_SOURCES);
        for (const sourceKey in sources) {
            const sourceV = sources[sourceKey];
            const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, sourceV.pos.x, sourceV.pos.y))
            for (var i = 0; i < paths.length; i++) {
                const path = paths[i];
                const ter = room.lookForAt(LOOK_TERRAIN, path.x, path.y);
                if (ter != 'wall') {
                    room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
                }
            }
        }
    },

    buildRoadsFromMasterSpawnToController: function(room) {
        if (room.memory.spawnMaster == null || !room.controller.my) {
            return;
        }
        const startPosition = {pos: room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), room: room};
        
        const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, room.controller.pos.x, room.controller.pos.y))
        for (var i = 0; i < paths.length; i++) {
            const path = paths[i];
            const ter = room.lookForAt(LOOK_TERRAIN, path.x, path.y);
            if (ter != 'wall') {
                room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
            }
        }
    },
    
    build_roads_from_source: function(source) {
        if (!source.room.controller.my) {
            return;
        }
        if ((Game.time + 10) % 1000 == 0) {
            // build road from source to controller
            const obsticalD = {};
            for (ob in OBSTACLE_OBJECT_TYPES) {
                obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
            }
            const path = source.pos.findPathTo(source.room.controller.pos, {ignoreCreeps: true});
            for (var i = 0; i < path.length; i++) {
                const ter = source.room.lookForAt(LOOK_TERRAIN, path[i].x, path[i].y)
                const struct = source.room.lookForAt(LOOK_STRUCTURES, path[i].x, path[i].y)
                
                if (struct.length > 0 && struct[0].structureType in obsticalD) {
                    continue;
                }
                if (ter != 'wall') {
                    source.room.createConstructionSite(path[i].x, path[i].y, STRUCTURE_ROAD);
                }
            }
            return;
        }
        
        // build road from source to spawn
        if ((Game.time + 20) % 1000 == 0) {
            const obsticalD = {};
            for (ob in OBSTACLE_OBJECT_TYPES) {
                obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
            }
            const energy_storages = source.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_SPAWN);
                }
            });
            for (var j = 0; j < energy_storages.length; j++) {
                const path = source.pos.findPathTo(energy_storages[j].pos, {ignoreCreeps: true});
                
                for (var i = 0; i < path.length; i++) {
                    const struct = source.room.lookForAt(LOOK_STRUCTURES, path[i].x, path[i].y)
                
                    var found = false;
                    for (const s in struct) {
                        if (struct[s].structureType in obsticalD) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        continue;
                    }
                    
                    source.room.createConstructionSite(path[i].x, path[i].y, STRUCTURE_ROAD);
                }
            }
            return;
        }
    },
    
    remove_old_roads: function(room) {
        // cleanup old roads that are on buildings as they are untraversable so why upkeep
        // todo delete roads that are covering structures that cant be crossed
        const road_paths = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType == STRUCTURE_ROAD;
            }
        });
        
        const obsticalD = {};
        for (ob in OBSTACLE_OBJECT_TYPES) {
            obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
        }
        for (const k in road_paths) {
            const struct = room.lookForAt(LOOK_STRUCTURES, road_paths[k].pos.x, road_paths[k].pos.y)
            var impassible = false;
            if (struct.length > 1) {
                for (s in struct) {
                    if (struct[s].structureType in obsticalD) {
                        impassible = true;
                        break;
                    }
                }
                if (impassible)
                    road_paths[k].destroy();
            }
        }
    },

    buildRoadsFromMasterSpawnToExits: function(room) {
        // first let's check check highway
        if (Memory.highway == null || !room.controller.my) {
            // no highway just exit
            return;
        }

        const startPosition = {pos: room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), room: room};

        const currentRoom = Memory.highway[room.name];
        for (const roomK in currentRoom) {
            const roomV = currentRoom[roomK];
            const start = roomV.start;
            if (start != null) {
                // build road from master spawn to start
                const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, start.x, start.y))
                for (var i = 0; i < paths.length; i++) {
                    const path = paths[i];
                    const ter = room.lookForAt(LOOK_TERRAIN, path.x, path.y);
                    if (ter != 'wall') {
                        room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
                    }
                }
            }
        }
    }
}

module.exports = construction;