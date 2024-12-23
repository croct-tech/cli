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

    public intersects(other: Version): boolean {
        if (other.isRange()) {
            return other.intersects(this);
        }

        if (this.isRange()) {
            if (other.isRange()) {
                return this.getMinVersion() <= other.getMaxVersion()
                    && other.getMinVersion() <= this.getMaxVersion();
            }

            if (other.isExact()) {
                const version = other.getExactVersion();

                return this.getMinVersion() <= version
                    && version <= this.getMaxVersion();
            }

            const minimum = this.getMinVersion();
            const maximum = this.getMaxVersion();

            return other.getVersions().some(version => minimum <= version && version <= maximum);
        }

        const leftVersions = this.getVersions();
        const rightVersions = other.getVersions();

        if (leftVersions.length === 0 || rightVersions.length === 0) {
            return false;
        }

        return leftVersions.some(version => rightVersions.includes(version));
    }

    public contains(other: Version): boolean {
        if (this.isExact() && other.isExact()) {
            return this.getExactVersion() === other.getExactVersion();
        }

        if (this.isRange()) {
            if (other.isRange()) {
                return this.getMinVersion() <= other.getMinVersion()
                    && other.getMaxVersion() <= this.getMaxVersion();
            }

            if (other.isExact()) {
                const version = other.getExactVersion();

                return this.getMinVersion() <= version
                    && version <= this.getMaxVersion();
            }

            const minimum = this.getMinVersion();
            const maximum = this.getMaxVersion();

            return other.getVersions()
                .every(version => minimum <= version && version <= maximum);
        }

        if (!other.isSet()) {
            return false;
        }

        const versions = this.getVersions();

        return other.getVersions().every(version => versions.includes(version));
    }

    // Removes the versions specified in the other version from this version.
    public except(other: Version): Version {
        if (!this.intersects(other)) {
            return this;
        }

        if (other.contains(this)) {
            throw new Error('A version cannot be empty.');
        }

        if (this.isRange()) {
            if (other.isExact()) {
                if (this.getMinVersion() === other.getExactVersion()) {
                    return Version.between(other.getExactVersion() + 1, this.getMaxVersion());
                }

                if (this.getMaxVersion() === other.getExactVersion()) {
                    return Version.between(this.getMinVersion(), other.getExactVersion() - 1);
                }
            } else if (other.isRange()) {
                if (this.getMinVersion() === other.getMinVersion()) {
                    return Version.between(other.getMaxVersion() + 1, this.getMaxVersion());
                }

                if (this.getMaxVersion() === other.getMaxVersion()) {
                    return Version.between(this.getMinVersion(), other.getMinVersion() - 1);
                }
            } else if (other.isSet()) {
                const versions = other.getVersions();
                const isSequential = versions.every((version, index) => version === other.getMinVersion() + index);

                if (isSequential) {
                    if (this.getMinVersion() === other.getMinVersion()) {
                        return Version.between(other.getMaxVersion() + 1, this.getMaxVersion());
                    }

                    if (this.getMaxVersion() === other.getMaxVersion()) {
                        return Version.between(this.getMinVersion(), other.getMinVersion() - 1);
                    }
                }
            }
        }

        if (other.isRange()) {
            const min = other.getMinVersion();
            const max = other.getMaxVersion();

            return Version.either(...this.getVersions().filter(version => version < min || version > max));
        }

        const excludedVersions = other.getVersions();

        return Version.either(...this.getVersions().filter(version => !excludedVersions.includes(version)));
    }

    public combinedWith(other: Version): Version {
        if (this.contains(other)) {
            return this;
        }

        if (other.isRange()) {
            return other.combinedWith(this);
        }

        if (this.isRange()) {
            if (other.isExact()) {
                if (this.getMaxVersion() + 1 === other.getExactVersion()) {
                    return Version.between(this.getMinVersion(), other.getExactVersion());
                }

                if (other.getExactVersion() + 1 === this.getMinVersion()) {
                    return Version.between(other.getExactVersion(), this.getMaxVersion());
                }
            } else if (other.isRange()) {
                if (
                    this.getMaxVersion() + 1 === other.getMinVersion()
                    || other.getMaxVersion() + 1 === this.getMinVersion()
                ) {
                    return Version.between(
                        Math.min(this.getMinVersion(), other.getMinVersion()),
                        Math.max(this.getMaxVersion(), other.getMaxVersion()),
                    );
                }
            } else if (other.isSet() && this.contains(this)) {
                return this;
            }
        }

        return Version.either(...this.getVersions(), ...other.getVersions());
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
