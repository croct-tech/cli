export class Version {
    private readonly min?: number;

    private readonly max?: number;

    private readonly versions: readonly number[];

    private constructor(versions?: readonly number[], min?: number, max?: number) {
        this.min = min;
        this.max = max;
        this.versions = versions ?? [];
    }

    public static isValid(version: string): boolean {
        try {
            Version.parse(version);

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Creates a new major version pattern from the given limits.
     *
     * Both bounds are inclusive.
     *
     * @param {number} min The minimum limit, inclusive.
     * @param {number} max The maximum limit, inclusive.
     *
     * @throws {Error} If the minimum is greater than the maximum limit.
     *
     * @returns {Version} The pattern representing the specified range.
     */
    public static between(min: number, max: number): Version {
        if (min === max) {
            return new Version([min]);
        }

        if (min > max) {
            throw new Error(`Out of order range ${min}-${max}`);
        }

        return new Version(undefined, min, max);
    }

    public static of(version: number): Version {
        return new Version([version]);
    }

    public static either(...versions: readonly number[]): Version {
        if (versions.length === 0) {
            throw new Error('No versions specified.');
        }

        return new Version([...new Set(versions)].sort((left, right) => left - right));
    }

    public static parse(string: string): Version {
        if (/^\d+$/.test(string)) {
            return new Version([Number.parseInt(string, 10)]);
        }

        const {groups} = string.match(/^((?<range>(?<min>\d+)\s*-\s*(?<max>\d+))|(?<set>\d+(\s*\|\|\s*\d+)+))$/) ?? {};

        if (groups === undefined) {
            throw new Error(`Invalid version pattern: ${string}`);
        }

        if (groups.range !== undefined) {
            return Version.between(
                Number.parseInt(groups.min, 10),
                Number.parseInt(groups.max, 10),
            );
        }

        return Version.either(
            ...groups.set
                .split('||')
                .map(version => Number.parseInt(version, 10)),
        );
    }

    public isRange(): boolean {
        return this.min !== undefined && this.max !== undefined;
    }

    public isSet(): boolean {
        return this.versions.length > 0;
    }

    public isExact(): boolean {
        return this.versions.length === 1;
    }

    public getCardinality(): number {
        if (this.min !== undefined && this.max !== undefined) {
            return this.max - this.min + 1;
        }

        return this.versions.length;
    }

    public getExactVersion(): number {
        if (!this.isExact()) {
            throw new Error('Not an exact version.');
        }

        return this.versions[0];
    }

    public getMinVersion(): number {
        return this.min ?? Math.min(...this.versions);
    }

    public getMaxVersion(): number {
        return this.max ?? Math.max(...this.versions);
    }

    public getVersions(): readonly number[] {
        const {min, max} = this;

        if (min === undefined || max === undefined) {
            return this.versions;
        }

        const versions: number[] = [];

        for (let version = min; version <= max; version++) {
            versions.push(version);
        }

        return versions;
    }

    public equals(other: Version): boolean {
        if (other.min !== this.min || other.max !== this.max) {
            return false;
        }

        if (other.versions.length !== this.versions.length) {
            return false;
        }

        for (let index = 0; index < this.versions.length; index++) {
            if (this.versions[index] !== other.versions[index]) {
                return false;
            }
        }

        return true;
    }

    public toString(): string {
        if (this.isSet()) {
            return this.versions.join(' || ');
        }

        return `${this.min} - ${this.max}`;
    }

    public toJSON(): string {
        return this.toString();
    }
}
