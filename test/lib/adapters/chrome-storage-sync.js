/**
 * chrome storage adapter 
 * syncs a user's data on google's cloud
 * only works in a chrome app or extension with a 
 * manifest that has the 'storage' permission
 * see https://developer.chrome.com/apps/storage.html
 * === 
 * - based on dom.js
 * - dom.js originally authored by Joseph Pecoraro
 *
 */ 
//
// decision: use an indexer to make .keys faster? 
// // .exists would be just as fast (you're getting one entry)
//
Lawnchair.adapter('chrome-storage-sync', (function() {
    var storage = chrome.storage.sync
    // the indexer is an encapsulation of the helpers needed to keep an ordered index of the keys
    // the only real reason to use an index here is to make .keys faster

    var indexer = function(name) {
        return {
            // the key
            key: name + '._index_',
            // returns the index, an array of keys
            idx: function(that, callback) {
                // var that = this;
                var self = this;
                storage.get(self.key, function(data){
                    // could be optimized
                    var t_index = [];
                    t_index.concat(data[self.key]);
                    console.log(t_index)
                    callback.call(t_index) 
                    // apply the callback to the index array
                });
            },
            all: function(that, callback) {
                // var that = this;
                var self = this;
                storage.get(null, function(everything){
                    //you probably don't also want the index
                    delete everything[self.key]
                    //exlusion is faster for a db with > 2 keys
                    //now we want it to be an array because that's the spec
                    that.lambda(callback.call(everything));
                });
            },
            // adds a key to the index
            add: function (that, keyOrArray) {
                var self = this;
                this.idx(that, function(a){
                    // var a = the_index;
                    console.log(a)
                    if(Array.isArray(keyOrArray)){
                        a.concat(keys)
                    }else{
                        a.push(key);
                    }
                    var l = a.length
                    for(var i=0; i<l; ++i) {
                        for(var j=i+1; j<l; ++j) {
                            if(a[i] === a[j])
                                a.splice(j, 1);
                        }
                    }
                    var tosave = {}
                    tosave[self.key] = a;
                    storage.set(tosave, function() {
                        // console.log('updated the index!')
                    });
                });
            },
            // deletes a key from the index
            del: function (that, keyOrArray) {
                var self = this;
                this.idx(that, function(the_index){
                    var tosave = {}

                    if(Array.isArray(keyOrArray)){
                        the_index = the_index.filter(function(item) {
                            return keys.indexOf(item) === -1;
                        });
                    }else{
                        the_index.splice(the_index.indexOf(keyOrArray), 1);
                    }                 

                    tosave[self.key] = the_index
                    storage.set(tosave, function() {
                        // console.log('updated the index!')
                    });
                });
            }
        }
    }
    
    // adapter api 
    return {
    
        // ensure we are in an env with localStorage 
        valid: function () {
            return !!storage
        },

        init: function (options, callback) { // done
            // consider making the indexer optional
            this.indexer = indexer(this.name)
            if (callback) this.fn(this.name, callback).call(this, this)  
        },
        
        save: function (obj, callback) { // done
            var that = this;
            var key = obj.key ? obj.key : this.uuid()
            // now we kil the key and use it in the store colleciton    
            delete obj.key;
            var tosave = {}
            tosave[key] = obj

            storage.set(tosave, function() {
                // checking for existence and THEN writing is slower
                // than just writing; Unless you keep the index in memory instead
                that.indexer.add(that, key)
                // the indexer rejects dupes
                if (callback) {
                    that.lambda(callback).call(that, obj)
                }
            });
            return this
        },

        batch: function (ary, callback) { // done
            var that = this;
            var keys_to_index = [];
            var tosave = {}
            for (var i = 0, l = ary.length; i < l; i++) {
                var key = arr[i].key ? that.name + '.' + obj.key : that.name + '.' + that.uuid()
                keys_to_index.push(key);
                tosave[key] = arr[i];
            }
            storage.set(tosave, function(){
                // success!
                indexer.add(that, that.keys_to_index);
                if (callback) that.lambda(callback).call(that, that.ary);
            });
            return this
        },
       
        // accepts [options], callback
        keys: function(callback) { // done
            if (callback) {
                var that = this;
                //with indexer
                storage.idx(that, function(the_index){
                    that.lambda(callback).call(the_index)                    
                });
                //without indexer
                // chrome.storage.sync.get(null, function(objs){
                //     var keys = Object.keys(objs);
                //     that.fn('keys', callback).call(that, keys)
                // });
            }
            return this // TODO options for limit/offset, return promise
        },
        
        get: function (keys, callback) { // done
            if(callback){
                var that = this;
                if (this.isArray(keys)) {
                    storage.get(keys, function(items){
                        var results = [];
                        var rs_keys = Object.keys(items);
                        for (var i = rs_keys.length - 1; i >= 0; i--) {
                            results.push({key:rs_keys[i], value:items[rs_keys[i]] })
                        };
                        that.lambda(callback).call(that, results)
                    });
                } else {
                    var key = keys;
                    storage.get(key, function(item){
                        var result = {}
                        result.key = key;
                        result.value = item;
                        that.lambda(callback).call(that, result)
                    });
                }
            }
            return this
        },

        exists: function (key, cb) { // done
            var that = this;

            //this kindof violates the abstraction layer
            indexer.idx(that, function(the_index){
                var exists = the_index.indexOf(key) > -1
                that.lambda(cb).call(that, exists);
            });

            // without an indexer
            // storage.get(key, function(obj){
            //     var exists = Object.keys(obj).length === 0
            //     that.lambda(cb).call(that, exists);
            // });            
            return this;
        },
        // NOTE adapters cannot set this.__results but plugins do
        // this probably should be reviewed
        all: function (callback) { // done
            var that = this;
            if (callback) {
                storage.get(null, function(everything){
                    //you probably don't also want the index
                    delete everything[indexer.key]
                    //exlusion is faster for a db with > 2 keys
                    //now we want it to be an array because that's the spec
                    // TODO: Optimize this
                    var results = [];
                    var rs_keys = Object.keys(everything);
                    for (var i = rs_keys.length - 1; i >= 0; i--) {
                        results.push(everything[rs_keys[i]])
                    };
                    that.lambda(callback.call(results));
                });
            }
            return this
        },
        
        remove: function (keyOrArray, callback) { // done
            var that = this;
            indexer.del(that, keyOrArray);
            storage.remove(keyOrArray, function(){
                if (callback) that.lambda(callback).call(that)
                // we made it!
            });
            return this
        },
        
        nuke: function (callback) { // done
            var that = this;
            storage.clear(function(){
                // wohoo! end of the world!
                if (callback) that.lambda(callback).call(that)
            });
            return this 
        }
}})());
