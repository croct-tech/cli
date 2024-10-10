export type ResourceId = string;

export type VersionPattern = string;

export type VersionedResourceId = ResourceId;

export type ParsedVersionedResourceId = {
    id: string,
    version?: VersionPattern,
};

export namespace VersionedResourceId {
    export function parse(resourceId: VersionedResourceId): ParsedVersionedResourceId {
        const match = resourceId.match(/^([^@])+(?:@(\d+(\.\d+(\.\d+)?)?))?$/);

        if (match === null) {
            throw new Error('Malformed resource ID.');
        }

        const [, id, version] = match;

        return {
            id: id,
            ...(version !== undefined ? {version: version} : {}),
        };
    }
}

export class VersionSpecification {
    // eslint-disable-next-line max-len -- Regex can't be split
    private static readonly PATTERN = /^((?<range>(?<min>\d+(?:\.(\d+)(?:\.(\d+))?)?)\s*-\s*(?<max>\d+(?:\.(\d+)(?:\.(\d+))?)?))|(?<set>\d+(?:\.(\d+)(?:\.(\d+))?)?(\s*\|\|\s*\d+(?:\.(\d+)(?:\.(\d+))?)?)+))$/;

    private readonly min?: Version;

    private readonly max?: Version;

    private readonly versions: readonly Version[];

    private constructor(versions?: readonly Version[], min?: Version, max?: Version) {
        this.min = min;
        this.max = max;
        this.versions = versions ?? [];
    }

    /**
     * Creates a new major version pattern from the given limits.
     *
     * Both bounds are inclusive.
     *
     * @param {Version} min The minimum limit, inclusive.
     * @param {Version} max The maximum limit, inclusive.
     *
     * @throws {Error} If the minimum is greater than the maximum limit.
     *
     * @returns {VersionSpecification} The pattern representing the specified range.
     */
    public static between(min: Version, max: Version): VersionSpecification {
        if (min.equals(max)) {
            return new VersionSpecification([min]);
        }

        if (min.compare(max) > 0) {
            throw new Error(`Out of order range ${min}-${max}`);
        }

        return new VersionSpecification(undefined, min, max);
    }

    public static either(...versions: readonly Version[]): VersionSpecification {
        if (versions.length === 0) {
            throw new Error('No versions specified.');
        }

        return new VersionSpecification([...new Set(versions)].sort(Version.compareAscending));
    }

    public static parse(string: string): VersionSpecification {
        if (Version.isValid(string)) {
            return new VersionSpecification([Version.parse(string)]);
        }

        const {groups} = string.match(VersionSpecification.PATTERN) as {
            groups?: {
                set: string,
                range?: never,
            } | {
                range: string,
                min: string,
                max: string,
                set?: never,
            },
        };

        if (groups === undefined) {
            throw new Error(`Invalid version pattern: ${string}`);
        }

        if (groups.range !== undefined) {
            return VersionSpecification.between(
                Version.parse(groups.min),
                Version.parse(groups.max),
            );
        }

        return VersionSpecification.either(
            ...groups.set
                .split('||')
                .map(Version.parse),
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

    public getExactVersion(): Version {
        if (!this.isExact()) {
            throw new Error('Not an exact version.');
        }

        return this.versions[0];
    }

    public getMinVersion(): Version {
        if (this.min === undefined && this.versions.length !== 1) {
            throw new Error('Undetermined minimum version.');
        }

        return this.min ?? this.versions[0];
    }

    public getMaxVersion(): Version {
        if (this.max === undefined && this.versions.length !== 1) {
            throw new Error('Undetermined maximum version.');
        }

        return this.max ?? this.versions[0];
    }

    public isSatisfiedBy(version: Version): boolean {
        if (this.min !== undefined && this.max !== undefined) {
            return this.min.compare(version) >= 0
                && this.max.compare(version) <= 0;
        }

        return this.versions.some(candidate => candidate.equals(version));
    }

    public getCardinality(): number {
        if (this.min !== undefined && this.max !== undefined) {
            return this.max.major - this.min.major + 1;
        }

        return this.versions.length;
    }

    public equals(other: VersionSpecification): boolean {
        if (
            !VersionSpecification.isEqualBound(this.min, other.min)
            || !VersionSpecification.isEqualBound(this.max, other.max)
        ) {
            return false;
        }

        if (other.versions.length !== this.versions.length) {
            return false;
        }

        for (let index = 0; index < this.versions.length; index++) {
            if (!this.versions[index].equals(other.versions[index])) {
                return false;
            }
        }

        return true;
    }

    private static isEqualBound(left: Version | undefined, right: Version | undefined): boolean {
        if (left === undefined || right === undefined) {
            return left === undefined && right === undefined;
        }

        return left.equals(right);
    }

    public toString(): string {
        if (this.isSet()) {
            return this.versions.join(' || ');
        }

        return `${this.min} - ${this.max}`;
    }
}

/**
 * The parts that make up the version number.
 */
export type VersionParts = {
    /**
     * The major version number.
     */
    major: number,

    /**
     * The minor version number.
     */
    minor?: number,

    /**
     * The patch version number.
     */
    patch?: number,
};

export type NormalizedVersionString = `${number}.${number}.${number}`;

export type VersionString = `${number}` | `${number}.${number}` | NormalizedVersionString;

/**
 * An immutable object value representing a semantic version.
 *
 * @see https://semver.org/
 */
export class Version {
    /**
     * A pattern that matches a valid version string.
     */
    public static readonly PATTERN = /^(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+))?)?$/;

    /**
     * The major version number.
     */
    public readonly major: number;

    /**
     * The minor version number.
     */
    public readonly minor?: number;

    /**
     * The patch version number.
     */
    public readonly patch?: number;

    /**
     * Constructs a new instance.
     *
     * @param major The major version number.
     * @param minor The minor version number.
     * @param patch The patch version number.
     */
    private constructor(major: number, minor?: number, patch?: number) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    /**
     * Creates a new version object from the given parts.
     *
     * @param parts The parts of the version.
     *
     * @returns The version with the given parts.
     *
     * @throws {Error} If either the major or minor version number are either non-integers or
     * negative.
     */
    public static fromParts({major, minor, patch}: VersionParts): Version {
        if (!Number.isSafeInteger(major) || major < 0) {
            throw new Error('The major part must be an integer greater than or equal to 0');
        }

        if (minor !== undefined && (!Number.isSafeInteger(minor) || minor < 0)) {
            throw new Error('The minor part must be an integer greater than or equal to 0');
        }

        if (patch !== undefined && (!Number.isSafeInteger(patch) || patch < 0)) {
            throw new Error('The patch part must be an integer greater than or equal to 0');
        }

        return new Version(major, minor, patch);
    }

    /**
     * Parses the given string into a version object.
     *
     * @param version The string to parse.
     *
     * @returns The parsed version.
     *
     * @throws {Error} If the string is not a valid version.
     */
    public static parse(version: string): Version {
        const {groups} = (version.match(Version.PATTERN) ?? {}) as {
            groups?: {
                major: string,
                minor?: string,
                patch?: string,
            },
        };

        if (groups === undefined) {
            throw new Error(`Malformed version string '${version}'.`);
        }

        const {major, minor, patch} = groups;

        return Version.fromParts({
            major: Number.parseInt(major, 10),
            minor: minor !== undefined ? Number.parseInt(minor, 10) : undefined,
            patch: patch !== undefined ? Number.parseInt(patch, 10) : undefined,
        });
    }

    /**
     * Tests whether the version string is valid.
     */
    public static isValid(version: string): version is VersionString {
        return version.match(Version.PATTERN) !== null;
    }

    /**
     * Returns the latest of the two given versions.
     *
     * @param version The left version.
     * @param others The others
     *
     * @returns The latest of the two given versions.
     */
    public static latest(version: Version, ...others: Version[]): Version {
        return others.reduce(
            (latest, candidate) => (latest.compare(candidate) > 0 ? candidate : latest),
            version,
        );
    }

    /**
     * Returns the earliest of the two given versions.
     *
     * @param version The left version.
     * @param others The right version.
     *
     * @returns The earliest of the two given versions.
     */
    public static earliest(version: Version, ...others: Version[]): Version {
        return others.reduce(
            (earliest, candidate) => (earliest.compare(candidate) < 0 ? candidate : earliest),
            version,
        );
    }

    /**
     * Compares two versions for ascending ordering.
     *
     * @param left The first version to compare.
     * @param right The second version to compare.
     *
     * @returns `-1` if the first version is prior to the second one,
     * `0` if they are equal, `1` if the first version is after the second one.
     */
    public static compareAscending(left: Version, right: Version): number {
        return left.compare(right);
    }

    /**
     * Compares two versions for descending ordering.
     *
     * @param left The first version to compare.
     * @param right The second version to compare.
     *
     * @returns `1` if the first version is prior to the second one,
     * `0` if they are equal, `-1` if the first version is after the second one.
     */
    public static compareDescending(left: Version, right: Version): number {
        return right.compare(left);
    }

    /**
     * Returns the next major version.
     */
    public bumpMajor(): Version {
        return new Version(this.major + 1, 0, 0);
    }

    /**
     * Returns the next minor version.
     */
    public bumpMinor(): Version {
        return new Version(this.major, (this.minor ?? 0) + 1, 0);
    }

    /**
     * Returns the next minor version.
     */
    public bumpPatch(): Version {
        return new Version(this.major, this.minor ?? 0, (this.patch ?? 0) + 1);
    }

    /**
     * Checks whether the major version is equal to the given one.
     *
     * @param other The other version to compare.
     *
     * @returns `true` if the major version is equal to the given one, `false` otherwise.
     */
    public isCompatibleWith(other: Version): boolean {
        return this.major === other.major;
    }

    public equals(other: unknown): other is Version {
        return other instanceof Version && this.compare(other) === 0;
    }

    /**
     * Compares this version to the given one for ordering.
     *
     * @param other The other version to compare.
     *
     * @returns `-1` if this version is prior to the given one,
     * `0` if they are equal, `1` if this version is after the given one.
     */
    public compare(other: Version): number {
        if (this.major !== other.major) {
            return this.major - other.major;
        }

        const minor = this.minor ?? 0;
        const otherMinor = other.minor ?? 0;

        if (minor !== otherMinor) {
            return minor - otherMinor;
        }

        const patch = this.patch ?? 0;
        const otherPath = other.patch ?? 0;

        return patch - otherPath;
    }

    /**
     * Returns the parts that make up this version.
     */
    public toParts(): VersionParts {
        return {
            major: this.major,
            ...(this.minor !== undefined ? {minor: this.minor} : {}),
            ...(this.patch !== undefined ? {patch: this.patch} : {}),
        };
    }

    public toNormalizedParts(): Required<VersionParts> {
        return {
            major: this.major,
            minor: this.minor ?? 0,
            patch: this.patch ?? 0,
        };
    }

    public normalized(): Version {
        return new Version(this.major, this.minor ?? 0, this.patch ?? 0);
    }

    /**
     * Returns the JSON representation of this version.
     */
    public toJSON(): VersionParts {
        return this.toParts();
    }

    public toNormalizedString(): NormalizedVersionString {
        return `${this.major}.${this.minor ?? 0}.${this.patch ?? 0}`;
    }

    /**
     * Returns the string representation of this version.
     */
    public toString(): string {
        let version = `${this.major}`;

        if (this.minor !== undefined) {
            version += `.${this.minor}`;
        }

        if (this.patch !== undefined) {
            version += `.${this.patch}`;
        }

        return version;
    }
}
