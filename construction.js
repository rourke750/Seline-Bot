const utils = require('utils');
const common = require('common');
const pathFinder = require('pathFinder');
const os = require('os');

const obsticalD = {};
for (ob in OBSTACLE_OBJECT_TYPES) {
    obsticalD[OBSTACLE_OBJECT_TYPES[ob]] = true;
}
const roadStructs = {};
roadStructs[STRUCTURE_ROAD] = true;
 
var construction = {

    build_missing_spawn: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            return;
        }
        if (room.controller.my && room.memory.spawnMaster == null && room.name in Memory.flags.capture) {
            // let's try place a master spawn
            // lets see if there is a flag we were just captured
            const flags = room.find(FIND_FLAGS);
            let f = null;
            for (const fK in flags) {
                const flag = flags[fK];
                if (flag.name.startsWith('Capture')) {
                    f = flag;
                    break
                }
            }
            room.memory['spawnMasterX'] = f.pos.x;
            room.memory['spawnMasterY'] = f.pos.y;
            room.memory['spawnMaster'] = `${room.name}-1`;
            this.buildSpawnCenter(room);
            f.remove();
        }
    },

    doesConstructionExistAndCantBuild: function(room, pos, additionalStructs={}) { // return true if there is already a struct there or a construction site
        const struct = room.lookForAt(LOOK_STRUCTURES, pos[0], pos[1]);
        const c = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos[0], pos[1]);
        return (c.length > 0 || (struct.length > 0 && (struct[0].structureType in obsticalD || struct[0].structureType in additionalStructs)))
    },

    // build a link near the spawns and roads that are needed
    buildAuxNearSpawn: function(room) {
        // we want to build a link and roads around the spawn
        if (room.memory.spawnMaster == null) {
            return;
        }

        const paths = [];

        const linkLoc = room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+2);
        //linkLoc.createConstructionSite(STRUCTURE_LINK);
        paths.push([room.memory.spawnMasterX, room.memory.spawnMasterY+2, STRUCTURE_LINK]);

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
                if (this.doesConstructionExistAndCantBuild(room, v, roadStructs)) // if we are already constructing we do not want to call this method
                    continue;
                paths.push([v[0], v[1], STRUCTURE_ROAD]);
                //room.getPositionAt(v[0], v[1]).createConstructionSite(STRUCTURE_ROAD);
            }
        }
        //room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+1).createConstructionSite(STRUCTURE_ROAD);
        paths.push([room.memory.spawnMasterX, room.memory.spawnMasterY+1, STRUCTURE_ROAD]);

        // build roads around spawns
        const posOffset = [[0, 3], [-1, -2], [0, -1], [1, 4]]
        for (let i = 1; i <= 7; i += 2) {
            const pOff = posOffset[parseInt(i/2)]
            let positions = utils.buildLineDirection(room.memory.spawnMasterX + pOff[0], room.memory.spawnMasterY+pOff[1], i, 2)
            for (const ii in positions) {
                const v = positions[ii];
                if (this.doesConstructionExistAndCantBuild(room, v, roadStructs))
                    continue;
                //room.getPositionAt(v[0], v[1]).createConstructionSite(STRUCTURE_ROAD);
                paths.push([v[0], v[1], STRUCTURE_ROAD]);
            }
            //new RoomVisual(room.name).poly(positions, {stroke: '#000000', strokeWidth: .8, 
            //    opacity: .9});
        }

        // build defense towers

        // build storage container
        //const containerLoc = room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY+1);
        //containerLoc.createConstructionSite(STRUCTURE_CONTAINER);
        paths.push([room.memory.spawnMasterX, room.memory.spawnMasterY+1, STRUCTURE_CONTAINER]);

        // build main storage

        // send off to memory
        construction.buildMemoryConstruction(room.name, 'auxnearspawns', paths);
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

        const paths = [];

        // check if the master spawn is still there, if not rebuild it 
        if (room.memory.spawnMaster != null && !Game.spawns[room.memory.spawnMaster]) {
            // we are missing the master spawn rebuild it
            const n = `${room.name}-1`;
            // room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY).createConstructionSite(STRUCTURE_SPAWN, n);
            paths.push([room.memory.spawnMasterX, room.memory.spawnMasterY, STRUCTURE_SPAWN]);
            room.memory.spawnMaster = n;
        }
        const m = Game.spawns[room.memory.spawnMaster];
        if (m == null) {
            construction.buildMemoryConstruction(room.name, 'spawns', paths);
            return;
        }
        // check for bottom left spawn if we can build it

        let secondLocation = room.getPositionAt(m.pos.x-1, m.pos.y+1);
        if (!this.find_spawns_at_pos(room, secondLocation)) { // didnt find a spawn lets build it
            const n = `${room.name}-2`;
            //secondLocation.createConstructionSite(STRUCTURE_SPAWN, n);
            paths.push([m.pos.x-1, m.pos.y+1, STRUCTURE_SPAWN]);
        }
        // check for bottom right spawn if we can build it
        secondLocation = room.getPositionAt(m.pos.x+1, m.pos.y+1);
        if (!this.find_spawns_at_pos(room, secondLocation)) { // didnt find a spawn lets build it
            const n = `${room.name}-3`;
            //secondLocation.createConstructionSite(STRUCTURE_SPAWN, n);
            paths.push([m.pos.x+1, m.pos.y+1, STRUCTURE_SPAWN]);
        }
        construction.buildMemoryConstruction(room.name, 'spawns', paths);
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
        
        // check if we already have the paths in the process of being built
        if (construction.doesMemoryExistConstructon(room.name, 'extensions')) {
            return;
        }

        const x = room.memory.spawnMasterX;
        const y = room.memory.spawnMasterY;
        
        const positions = []; // the positions to build exentions
        const paths = []; // the array to place the structures in memory

        positions.push(...this.get_extension_positions(x, y, 1, 1));
        positions.push(...this.get_extension_positions(x, y+2, 1, -1));
        positions.push(...this.get_extension_positions(x, y, -1, 1));
        positions.push(...this.get_extension_positions(x, y+2, -1, -1));
        for (var i = 0; i < positions.length; i++) {
            //var results = room.createConstructionSite(positions[i][0], positions[i][1], STRUCTURE_EXTENSION);
            paths.push([positions[i][0], positions[i][1], STRUCTURE_EXTENSION]);
            /*
            if (results == 0) {
                to_build--;
            }
            if (to_build == 0) 
                break
            */
        }
        construction.buildMemoryConstruction(room.name, 'extensions', paths);
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
            const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, sourceV.pos.x, sourceV.pos.y, {swampCost:2}))
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
        
        const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, room.controller.pos.x, room.controller.pos.y, {swampCost:2}))
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

        if (construction.doesMemoryExistConstructon(room.name, 'roadsfrommastertoexits')) {
            return;
        }

        const memoryPaths = [];

        const startPosition = {pos: room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), room: room};

        const currentRoom = Memory.highway[room.name];
        for (const roomK in currentRoom) {
            const roomV = currentRoom[roomK];
            const start = roomV.start;
            if (start != null) {
                // build road from master spawn to start
                const paths = Room.deserializePath(pathFinder.find_path_in_room(startPosition, start.x, start.y, {swampCost:2}))
                for (var i = 1; i < paths.length - 1; i++) {
                    const path = paths[i];
                    const ter = room.lookForAt(LOOK_TERRAIN, path.x, path.y);
                    const struct = room.lookForAt(LOOK_STRUCTURES, path.x, path.y);
                    if (ter != 'wall' && struct.length == 0) {
                        //room.createConstructionSite(path.x, path.y, STRUCTURE_ROAD);
                        memoryPaths.push([path.x, path.y, STRUCTURE_ROAD]);
                    }
                }
            }
        }
        construction.buildMemoryConstruction(room.name, 'roadsfrommastertoexits', memoryPaths);
    },

    buildWallsAndRamparts: function(roomName) {
        if (roomName != "W3N7") {
            return;
        }
        // todo scan each side and build the wall
        const room = Game.rooms[roomName]; 
        if (!room || !room.controller.my) {
            return;
        }
        const t = room.getTerrain();
        const exits = Game.map.describeExits(roomName);

        const eMap = {
            "1" : [0, 0, 2],
            "3" : [49, 0, 4],
            "5" : [0, 49, 2],
            "7" : [0, 0, 4],
        };

        for (const eK in exits) {
            let tmpPositions = utils.buildLineDirection(eMap[eK][0], eMap[eK][1], eMap[eK][2], 48);
            let tArray = null;
            const positionsArray = [];
            for (let k = tmpPositions.length - 1; k >= 0; k--) {
                const posi = tmpPositions[k];
                //const p = room.getPositionAt(posi[0], posi[1]);
                if (t.get(posi[0], posi[1]) == TERRAIN_MASK_WALL) {
                    if (tArray != null) {
                        positionsArray.push(tArray);
                        tArray = null;
                    }
                } else {
                    if (tArray == null) {
                        tArray = [];
                    }
                    if (eK == "1") {
                        posi[1] += 2;
                    } else if (eK == "3") {
                        posi[0] -= 2;
                    } else if (eK == "5") {
                        posi[1] -= 2;
                    } else {
                        v[0] += 2;
                    }
                    tArray.push(posi);
                }
            }
            if (tArray != null) {
                positionsArray.push(tArray);
                tArray = null;
            }
            
            let xMod = 0;
            let yMod = 0;
            for (const positionKey in positionsArray) {
                const positions = positionsArray[positionKey];
                const lastPostion = positions[0];
                const firstPostion = positions[positions.length - 1];
                if (eK == "1") { // top
                    for (let y = 0; y <= 2; y++) {
                        positions.push([lastPostion[0]+2, lastPostion[1]-y])
                        positions.unshift([firstPostion[0]-2, firstPostion[1]-y])
                    }
                    positions.push([lastPostion[0]+1, lastPostion[1]])
                    positions.unshift([firstPostion[0]-1, firstPostion[1]])
                    yMod = 2;
                } else if (eK == "3") { // right
                    for (let y = 0; y <= 2; y++) {
                        positions.push([firstPostion[0]+y, firstPostion[1]-2])
                        positions.unshift([lastPostion[0]+y, lastPostion[1]+2])
                    }
                    positions.push([lastPostion[0], lastPostion[1]] + 1)
                    positions.unshift([firstPostion[0], firstPostion[1]] - 1)
                    xMod = -2;
                } else if (eK == "5") { // bottom
                    for (let y = 0; y <= 2; y++) {
                        positions.push([lastPostion[0]+1, lastPostion[1]+y])
                        positions.unshift([firstPostion[0]-1, firstPostion[1]+y])
                    }
                    positions.push([lastPostion[0]+1, lastPostion[1]])
                    positions.unshift([firstPostion[0]-1, firstPostion[1]])
                    yMod = -2;
                } else { //left
                    for (let y = 0; y <= 2; y++) {
                        positions.push([firstPostion[0]-y, firstPostion[1]-1])
                        positions.unshift([lastPostion[0]-y, lastPostion[1]+1])
                    }
                    xMod = 2;
                }
            }
            //Memory.highway[roomName][exits[eK]] = undefined;
            if (Memory.highway[roomName][exits[eK]] == null) {
                pathFinder.find_highway(room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), exits[eK]);
            }
            // rampart position
            const start = Memory.highway[roomName][exits[eK]].start;
            const startX = start.x + xMod;
            const startY = start.y + yMod;
            for (const positionKey in positionsArray) {
                const positions = positionsArray[positionKey];
                for (const pK in positions) {
                    const pv = positions[pK];
                    const pos = room.getPositionAt(pv[0], pv[1]);
                    if (pv[0] == startX && pv[1] == startY) {
                        // build rampart
                        pos.createConstructionSite(STRUCTURE_RAMPART);
                    } else {
                        const e = pos.createConstructionSite(STRUCTURE_WALL);
                        if (e != 0) {
                            //console.log(e)
                        }
                    }
                }
            }

            // todo add edges and go to wallhg
            //new RoomVisual(room.name).poly(positions, {stroke: '#000000', strokeWidth: .8, 
            //    opacity: .9});
                break;
        }
        
        //console.log(exits["1"])
        //let pos = pathFinder.find_highway(room.getPositionAt(room.memory.spawnMasterX, room.memory.spawnMasterY), ); //todo find room west of current

        
    },

    doesMemoryExistConstructon: function(roomName, name) {
        const c = Memory.construction;
        if (!c || !(roomName in c) || !(name in c[roomName].paths) || c[roomName].paths.length == 0)
            return false;
        return true;
    },

    buildMemoryConstruction: function(roomName, name, paths) {
        // validate if we need to continue
        if (paths == null || paths.length == 0) {
            return;
        }
        // initialize any needed memory objects
        if (!Memory.construction) {
            Memory.construction = {};
        }
        // create the construction memory tab if doesnt exist for a room
        if (!Memory.construction[roomName]) {
            Memory.construction[roomName] = {};
        }
        // create paths for where each type will create its roads
        if (!Memory.construction[roomName].paths) {
            Memory.construction[roomName].paths = {};
        }
        
        // check if paths array exists for the name and if it does create it
        let memoryPaths = Memory.construction[roomName].paths;
        if (!(name in memoryPaths)) {
            Memory.construction[roomName].paths[name] = [];
        }
        memoryPaths = memoryPaths[name];
        
        if (memoryPaths.length > 0) {// if it does exist exit
            return;
        }
        
        let costs = Memory.construction[roomName].costMatrix;
        if (!costs) {
            Memory.construction[roomName].costMatrix = (new PathFinder.CostMatrix).serialize();
            costs = Memory.construction[roomName].costMatrix;
        }
        costs = PathFinder.CostMatrix.deserialize(costs);

        for (const k in paths) {
            const v = paths[k];
            if (v[2] == STRUCTURE_ROAD) {
                costs.set(v[0], v[1], 1);
            }
            memoryPaths.push(v);
        }
        Memory.construction[roomName].costMatrix = costs.serialize();
    },

    generateThreads: function(room) {
        const roomName = room.name;
        let name = 'construction-' + room.name + '-build_missing_spawn';
        if (!os.existsThread(name)) {
            const f = function() {
                construction.build_missing_spawn(room.name);
            } 
            os.newThread(name, f, 5, true);
        }

        name = 'construction-' + room.name + '-build_aux';
        if (!os.existsThread(name)) {
            const f = function() {
                const room = Game.rooms[roomName];
                if (!room) {
                    return;
                }
                construction.buildSpawnCenter(room); // hanldes building the spawns
                construction.build_extensions(room); // hanldes building the extensions
                // handles building the roads to extensions, towers, link near spawn, other center piece stuff
                construction.buildAuxNearSpawn(room);
                construction.buildRoadsFromMasterSpawnToExits(room);
                //todo need to finish converting bottom code to use memory construction
                construction.buildRoadFromMasterSpawnToSources(room);
                construction.buildRoadsFromMasterSpawnToController(room);
            } 
            os.newTimedThread(name, f, 10, 1, 20); // spawn a new timed thread that runs every 20 ticks
        }

        name = 'construction-' + room.name + '-remove_old_roads';
        if (!os.existsThread(name)) {
            const f = function() {
                construction.remove_old_roads(room);
            } 
            os.newTimedThread(name, f, 10, 1, 30); // spawn a new timed thread that runs every 30 ticks
        }

        name = 'construction-' + room.name + '-build_walls_and_ramparts'
        if (!os.existsThread(name)) {
            const f = function() {
                construction.buildWallsAndRamparts(roomName);
            } 
            //os.newTimedThread(name, f, 10, 1, 30); 
            os.newThread(name, f, 10);
        }
    }
}

module.exports = construction;