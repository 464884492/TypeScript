// Oldmap
/* @internal */
namespace ts {
    /**
     * Type of objects with a null prototype, meant to be used only as dictionaries.
     * Prefer to use StringMap.
     */
    //rename, or kill?
    export interface OldMap<T> {
        __oldMapBrand: any;
        [key: string]: T;
    }

    const hasOwnProperty = Object.prototype.hasOwnProperty; //neater
    export function createOldMap<T>(template?: MapLike<T>): OldMap<T> {
        const map = createDictionaryModeObject();
        for (const key in template) if (hasOwnProperty.call(template, key)) {
            map[key] = template[key];
        }
        return map;
    }

    //name
    export function oldMapHas<T>(oldMap: OldMap<T>, key: string) {
        // tslint:disable-next-line:no-in-operator
        return key in oldMap;
    }
}

// Map constructors: NumberMap and StringMap
/* @internal */
namespace ts {
    // The global Map object. This may not be available, so we must test for it.
    declare const Map: NumberMapStatic & StringMapStatic | undefined;
    const usingNativeMaps = typeof Map !== "undefined";

    //review
    export interface NumberMapStatic {
        /**
         * Creates a new NumberMap.
         * If `pairs` is provided, each [key, value] pair will be added to the map.
         */
        new<K extends number, V>(pairs?: [K, V][]): Map<K, V>;
    }

    /**
     * In runtimes without Maps, this is implemented using a sparse array.
     * This is generic over the key type because it is usually an enum.
     */
    export const NumberMap: NumberMapStatic = usingNativeMaps ? Map : class ShimNumberMap<K extends number, V> implements Map<K, V> {
        private data: { [key: number]: V } = [];

        constructor(pairs?: [K, V][]) {
            if (pairs) {
                for (const [key, value] of pairs) {
                    this.data[key as number] = value;
                }
            }
        }

        clear() {
            this.data = [];
        }

        delete(key: K) {
            delete this.data[key as number];
        }

        get(key: K) {
            return this.data[key as number];
        }

        has(key: K) {
            // tslint:disable-next-line:no-in-operator
            return (key as number) in this.data;
        }

        set(key: K, value: V) {
            this.data[key as number] = value;
        }

        forEach(action: (value: V, key: K) => void) {
            for (const key in this.data) {
                action(this.data[key], key as any as K);
            }
        }
    };

    //move
    export const mapSize: (map: Map<any, any>) => number = usingNativeMaps
        ? map => (map as any).size
        : map => {
            let size = 0;
            map.forEach(() => { size++; });
            return size;
        }

    interface Iterator<T> {
        next(): { value: T, done: false } | { value: never, done: true };
    }

    /** Completes the full ES6 Map spec. Internet Explorer does not provide these methods, so we must provide fallbacks. */
    interface FullyFeaturedMap<K, V> extends Map<K, V> {
        keys(): Iterator<K>;
        values(): Iterator<V>;
        entries(): Iterator<[K, V]>;
    }
    // tslint:disable-next-line:no-in-operator
    const fullyFeaturedMaps = usingNativeMaps && "keys" in Map.prototype && "values" in Map.prototype && "entries" in Map.prototype;

    export interface StringMapStatic {
        new<T>(): Map<string, T>;
    }
    /** In runtimes without Maps, this is implemented using an object. */
    export const StringMap: StringMapStatic = usingNativeMaps ? Map : class ShimStringMap<T> implements Map<string, T> {
        private data = createOldMap<T>();

        constructor() {}

        clear() {
            this.data = createOldMap<T>();
        }

        delete(key: string) {
            delete this.data[key];
        }

        get(key: string) {
            return this.data[key];
        }

        has(key: string) {
            return oldMapHas(this.data, key);
        }

        set(key: string, value: T) {
            this.data[key] = value;
        }

        forEach(f: (value: T, key: string) => void) {
            for (const key in this.data) {
                f(this.data[key], key);
            }
        }
    };

    //doc
    export function createMapWithEntry<T>(key: string, value: T): Map<string, T> {
        const map = new StringMap<T>();
        map.set(key, value);
        return map;
    }

    //TODO: don't export
    const createObject = Object.create;
    export function createDictionaryModeObject(): any {
        const map = createObject(null); // tslint:disable-line:no-null-keyword

        // Using 'delete' on an object causes V8 to put the object in dictionary mode.
        // This disables creation of hidden classes, which are expensive when an object is
        // constantly changing shape.
        map["__"] = undefined;
        delete map["__"];

        return map;
    }

    //doc
    export function setAndReturn<K, V>(map: Map<K, V>, key: K, value: V): V {
        map.set(key, value);
        return value;
    }

    //doc
    export const findInMap: <K, V, U>(map: Map<K, V>, f: (value: V, key: K) => U | undefined) => U | undefined = fullyFeaturedMaps
        ? <K, V, U>(map: FullyFeaturedMap<K, V>, f: (value: V, key: K) => U | undefined) => {
            const iter = map.entries();
            while (true) {
                const { value: pair, done } = iter.next();
                if (done) {
                    return undefined;
                }
                const [key, value] = pair;
                const result = f(value, key);
                if (result !== undefined) {
                    return result;
                }
            }
        }
        : <K, V, U>(map: Map<K, V>, f: (value: V, key: K) => U | undefined) => {
            let result: U | undefined;
            map.forEach((value, key) => {
                if (result === undefined)
                    result = f(value, key);
            });
            return result;
        };

    //not used outside of this file, so don't export.
    export const someInMap: <K, V>(map: Map<K, V>, predicate: (value: V, key: K) => boolean) => boolean = fullyFeaturedMaps
        ? <K, V>(map: FullyFeaturedMap<K, V>, predicate: (value: V, key: K) => boolean) =>
            someInIterator(map.entries(), ([key, value]) => predicate(value, key))
        : <K, V>(map: Map<K, V>, predicate: (value: V, key: K) => boolean) => {
            let found = false;
            map.forEach((value, key) => {
                found = found || predicate(value, key);
            });
            return found;
        };

    //just call some?
    export const _eachAndBreakIfReturningTrue: <K, V>(map: Map<K, V>, action: (value: V, key: K) => boolean) => void = someInMap;

    export const someKeyInMap: <K>(map: Map<K, any>, predicate: (key: K) => boolean) => boolean = fullyFeaturedMaps
        ? <K>(map: FullyFeaturedMap<K, any>, predicate: (key: K) => boolean) => someInIterator(map.keys(), predicate)
        : <K>(map: Map<K, any>, predicate: (key: K) => boolean) =>
            someInMap(map, (_value, key) => predicate(key));

    //only used in one place, kill? Write in terms of someInMap?
    export const someValueInMap: <T>(map: Map<any, T>, predicate: (value: T) => boolean) => boolean = fullyFeaturedMaps
        ? <T>(map: FullyFeaturedMap<any, T>, predicate: (value: T) => boolean) =>
            someInIterator(map.values(), predicate)
        : someInMap;

    function someInIterator<T>(iter: Iterator<T>, predicate: (value: T) => boolean): boolean {
        while (true) {
            const { value, done } = iter.next();
            if (done) {
                return false;
            }
            if (predicate(value)) {
                return true;
            }
        }
    }

    /** Equivalent to the ES6 code `for (const key of map.keys()) action(key)` */
    export const forEachKeyInMap: <K>(map: Map<K, any>, action: (key: K) => void) => void = fullyFeaturedMaps
        ? <K>(map: FullyFeaturedMap<K, any>, f: (key: K) => void) => {
            const iter: Iterator<K> = map.keys();
            while (true) {
                const { value: key, done } = iter.next();
                if (done) {
                    return;
                }
                f(key);
            }
        }
        : <K>(map: Map<K, any>, action: (key: K) => void) => {
            map.forEach((_value, key) => action(key));
        };
}

//Map extensions: don't depend on internal details
/* @internal */
namespace ts {
    //document
    export function modifyKeys<T>(map: Map<string, T>, alterKey: (key: string) => string): Map<string, T> {
        const newMap = new StringMap<T>();
        map.forEach((value, key) => {
            newMap.set(alterKey(key), value)
        });
        return newMap;
    }

    //document
    export function sortInV8ObjectInsertionOrder<T>(values: T[], toKey: (t: T) => string): T[] {
        const naturals: T[] = []; //name
        const everythingElse: T[] = [];
        for (const value of values) {
            // "0" looks like a natural but "08" doesn't.
            const looksLikeNatural = /^(0|([1-9]\d*))$/.test(toKey(value));
            (looksLikeNatural ? naturals : everythingElse).push(value);
        }
        function toInt(value: T): number {
            return parseInt(toKey(value), 10);
        }
        naturals.sort((a, b) => toInt(a) - toInt(b));
        return naturals.concat(everythingElse);
    }

    export function mapIsEmpty(map: Map<any, any>): boolean {
        return !someKeyInMap(map, () => true);
    }

    export function mapOfMapLike<T>(object: MapLike<T>): Map<string, T> {
        const map = new StringMap<T>();
        // Copies keys/values from template. Note that for..in will not throw if
        // template is undefined, and instead will just exit the loop.
        for (const key in object) if (hasProperty(object, key)) {
            map.set(key, object[key]);
        }
        return map;
    }

    export function mapLikeOfMap<T>(map: Map<string, T>): MapLike<T> {
        const obj = createDictionaryModeObject();
        map.forEach((value, key) => {
            obj[key] = value;
        });
        return obj;
    }

    //blah
    export function _mod<K, V>(map: Map<K, V>, key: K, modifier: (value: V) => V) {
        map.set(key, modifier(map.get(key)));
    }

    export function cloneMap<T>(map: Map<string, T>) {
        const clone = new StringMap<T>();
        copyMapEntriesFromTo(map, clone);
        return clone;
    }

    /**
     * Performs a shallow copy of the properties from a source Map<T> to a target Map<T>
     *
     * @param source A map from which properties should be copied.
     * @param target A map to which properties should be copied.
     */
    export function copyMapEntriesFromTo<K, V>(source: Map<K, V>, target: Map<K, V>): void {
        source.forEach((value, key) => {
            target.set(key, value);
        });
    }

    export function _mapValuesMutate<V>(map: Map<any, V>, mapValue: (value: V) => V): void {
        map.forEach((value, key) => {
            map.set(key, mapValue(value));
        });
    }

    //rename to keysOfMap
    export function _ownKeys<K>(map: Map<K, any>): K[] {
        const keys: K[] = [];
        forEachKeyInMap(map, key => { keys.push(key); });
        return keys;
    }

    export function valuesOfMap<V>(map: Map<any, V>): V[] {
        const values: V[] = [];
        map.forEach((value) => { values.push(value) });
        return values;
    }

    export function _getOrUpdate<K, V>(map: Map<K, V>, key: K, getValue: (key: K) => V): V {
        return map.has(key) ? map.get(key) : setAndReturn(map, key, getValue(key));
    }

    export function _setIfNotSet<K, V>(map: Map<K, V>, key: K, getValue: (key: K) => V): void {
        if (!map.has(key)) {
            map.set(key, getValue(key));
        }
    }

    /**
     * Creates a map from the elements of an array.
     *
     * @param array the array of input elements.
     * @param makeKey a function that produces a key for a given element.
     *
     * This function makes no effort to avoid collisions; if any two elements produce
     * the same key with the given 'makeKey' function, then the element with the higher
     * index in the array will be the one associated with the produced key.
     */
    export function arrayToMap<T>(array: T[], makeKey: (value: T) => string): Map<string, T>;
    export function arrayToMap<T, U>(array: T[], makeKey: (value: T) => string, makeValue: (value: T) => U): Map<string, U>;
    export function arrayToMap<T, U>(array: T[], makeKey: (value: T) => string, makeValue?: (value: T) => U): Map<string, T | U> {
        const result = new StringMap<T | U>();
        for (const value of array) {
            result.set(makeKey(value), makeValue ? makeValue(value) : value);
        }
        return result;
    }

    /**
     * Adds the value to an array of values associated with the key, and returns the array.
     * Creates the array if it does not already exist.
     */
    export function multiMapAdd<K, V>(map: Map<K, V[]>, key: K, value: V): V[] {
        const values = map.get(key);
        if (values) {
            values.push(value);
            return values;
        }
        else {
            return setAndReturn(map, key, [value]);
        }
    }

    /**
     * Removes a value from an array of values associated with the key.
     * Does not preserve the order of those values.
     * Does nothing if `key` is not in `map`, or `value` is not in `map[key]`.
     */
    export function multiMapRemove<K, V>(map: Map<K, V[]>, key: K, value: V): void {
        const values = map.get(key);
        if (values) {
            unorderedRemoveItem(values, value);
            if (!values.length) {
                map.delete(key);
            }
        }
    }

    //todo: neater
    export function _equalMaps<K, V>(left: Map<K, V>, right: Map<K, V>, equalityComparer?: (left: V, right: V) => boolean) {
        if (left === right) return true;
        if (!left || !right) return false;
        const someInLeftHasNoMatch = someInMap(left, (leftValue, leftKey) => {
            if (!right.has(leftKey)) return true;
            const rightValue = right.get(leftKey);
            return !(equalityComparer ? equalityComparer(leftValue, rightValue) : leftValue === rightValue);
        });
        if (someInLeftHasNoMatch) return false;
        const someInRightHasNoMatch = someKeyInMap(right, rightKey => !left.has(rightKey));
        return !someInRightHasNoMatch;
    }
}


// Set
/* @internal */
namespace ts {
    class ShimStringSet implements StringSet {
        private data = createOldMap<true>();

        constructor() {}

        add(value: string) {
            this.data[value] = true;
        }

        has(value: string) {
            return value in this.data;
        }

        delete(value: string) {
            delete this.data[value];
        }

        forEach(action: (value: string) => void) {
            for (const value in this.data) {
                action(value);
            }
        }

        isEmpty() {
            for (const _ in this.data) {
                return false;
            }
            return true;
        }
    }

    declare const Set: { new(): StringSet } | undefined;
    const usingNativeSets = typeof Set !== "undefined";
    export const StringSet: { new(): StringSet } = usingNativeSets ? Set : ShimStringSet;

    export const setIsEmpty: (set: StringSet) => boolean = usingNativeSets
        ? set => (set as any).size === 0
        : (set: ShimStringSet) => set.isEmpty();

    export function stringSetAggregate<T>(x: T[], getSet: (t: T) => StringSet): StringSet {
        const result = new StringSet();
        for (const t of x) {
            copySetValuesFromTo(getSet(t), result);
        }
        return result;
    }

    function copySetValuesFromTo<T>(source: StringSet, target: StringSet): void {
        source.forEach(value => target.add(value));
    }
}

//Set extensions
/* @internal */
namespace ts {
    //move
    export function filterSetToArray(set: StringSet, keepIf: (value: string) => boolean): string[] {
        const result: string[] = [];
        set.forEach(value => {
            if (keepIf(value))
                result.push(value);
        });
        return result;
    }
}

//MAPLIKE
/* @internal */
namespace ts {
    const hasOwnProperty = Object.prototype.hasOwnProperty; //neater

    export function clone<T>(object: T): T {
        const result: any = {};
        for (const id in object) {
            if (hasOwnProperty.call(object, id)) {
                result[id] = (<any>object)[id];
            }
        }
        return result;
    }

    /**
     * Indicates whether a map-like contains an own property with the specified key.
     *
     * NOTE: This is intended for use only with MapLike<T> objects. For Map<T> objects, use
     *       the 'in' operator.
     *
     * @param map A map-like.
     * @param key A property key.
     */
    export function hasProperty<T>(map: MapLike<T>, key: string): boolean {
        return hasOwnProperty.call(map, key);
    }

    //todo: use this to replace more for-in loops
    export function eachOwnProperty(object: any, useKey: (key: string) => void) {
        for (const key in object) {
            if (hasProperty(object, key)) {
                useKey(key);
            }
        }
    }

    /**
     * Gets the value of an owned property in a map-like.
     *
     * NOTE: This is intended for use only with MapLike<T> objects. For Map<T> objects, use
     *       an indexer.
     *
     * @param map A map-like.
     * @param key A property key.
     */
    export function getProperty<T>(map: MapLike<T>, key: string): T | undefined {
        return hasOwnProperty.call(map, key) ? map[key] : undefined;
    }

    /**
     * Gets the owned, enumerable property keys of a map-like.
     *
     * NOTE: This is intended for use with MapLike<T> objects. For Map<T> objects, use
     *       Object.keys instead as it offers better performance.
     *
     * @param map A map-like.
     */
    export function getOwnKeys<T>(map: MapLike<T>): string[] {
        const keys: string[] = [];
        for (const key in map) if (hasOwnProperty.call(map, key)) {
            keys.push(key);
        }
        return keys;
    }

    export function assign<T1 extends MapLike<{}>, T2, T3>(t: T1, arg1: T2, arg2: T3): T1 & T2 & T3;
    export function assign<T1 extends MapLike<{}>, T2>(t: T1, arg1: T2): T1 & T2;
    export function assign<T1 extends MapLike<{}>>(t: T1, ...args: any[]): any;
    export function assign<T1 extends MapLike<{}>>(t: T1, ...args: any[]) {
        for (const arg of args) {
            for (const p of getOwnKeys(arg)) {
                t[p] = arg[p];
            }
        }
        return t;
    }

    /**
     * Reduce the properties defined on a map-like (but not from its prototype chain).
     *
     * @param map The map-like to reduce
     * @param callback An aggregation function that is called for each entry in the map
     * @param initial The initial value for the reduction.
     */
    export function reduceOwnProperties<T, U>(map: MapLike<T>, callback: (aggregate: U, value: T, key: string) => U, initial: U): U {
        let result = initial;
        for (const key in map) if (hasOwnProperty.call(map, key)) {
            result = callback(result, map[key], String(key));
        }
        return result;
    }

    /**
     * Performs a shallow equality comparison of the contents of two map-likes.
     *
     * @param left A map-like whose properties should be compared.
     * @param right A map-like whose properties should be compared.
     */
    export function equalOwnProperties<T>(left: MapLike<T>, right: MapLike<T>, equalityComparer?: (left: T, right: T) => boolean) {
        if (left === right) return true;
        if (!left || !right) return false;
        for (const key in left) if (hasOwnProperty.call(left, key)) {
            if (!hasOwnProperty.call(right, key) === undefined) return false;
            if (equalityComparer ? !equalityComparer(left[key], right[key]) : left[key] !== right[key]) return false;
        }
        for (const key in right) if (hasOwnProperty.call(right, key)) {
            if (!hasOwnProperty.call(left, key)) return false;
        }
        return true;
    }

    export function extend<T1, T2>(first: T1 , second: T2): T1 & T2 {
        const result: T1 & T2 = <any>{};
        for (const id in second) if (hasOwnProperty.call(second, id)) {
            (result as any)[id] = (second as any)[id];
        }
        for (const id in first) if (hasOwnProperty.call(first, id)) {
            (result as any)[id] = (first as any)[id];
        }
        return result;
    }
}
