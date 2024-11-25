/**
 * Provides additional information about definitions for clarity and documentation.
 *
 * Annotations are optional properties that enhance the understandability of a definition.
 * They are not used for validation but as documentation elements to improve the definition's
 * readability and maintainability.
 */
export type Annotations = {
    /**
     * A human-readable label for the definition.
     */
    title?: string,

    /**
     * A human-readable description of the definition.
     */
    description?: string,
};

/**
 * Definition of a single structure attribute.
 */
export type AttributeDefinition = {
    /**
     * The type of the attribute.
     */
    type: ContentDefinition,

    /**
     * The label of the attribute.
     */
    label?: string,

    /**
     * The description of the attribute.
     */
    description?: string,

    /**
     * Whether the attribute is optional.
     */
    optional?: boolean,

    /**
     * Whether the attribute is private.
     */
    private?: boolean,

    /**
     * The order in which the attribute should be displayed.
     *
     * Interfaces should use this value to order the attributes as follows:
     *
     * - Attributes with a lower position value must be displayed before
     * attributes with a higher position value
     * - If two attributes have the same position value, no specific order
     * is guaranteed between them
     * - If no position is specified, no specific order is guaranteed.
     *
     * This property is used for display purposes only and does not affect
     * validation or serialization.
     */
    position?: number,
};

/**
 * Definition of one of the possible choices.
 */
export type ChoiceDefinition = {
    /**
     * The choice label.
     */
    label?: string,

    /**
     * The choice description.
     */
    description?: string,

    /**
     * Whether the choice is the default one.
     *
     * Interfaces should use this value to select the default choice as follows:
     *
     * - If exactly one option is marked as default, that option must be selected by default
     * - If no choice is marked as default, then no choice may be selected by default,
     * and an explicit choice must be required
     *
     * Multiple choices marked as default must be rejected as part of the schema validation.
     * Since it is possible from a typing perspective, the interface must arbitrarily select
     * one of the choices as the default one.
     *
     * This property is used for display purposes only and does not affect
     * validation or serialization.
     */
    default?: boolean,

    /**
     * The order in which the choice should be displayed.
     *
     * Interfaces should use this value to order the choices as follows:
     *
     * - Choices with a lower position value must be displayed before
     * choices with a higher position value
     * - If two choices have the same position value, no specific order
     * is guaranteed between them
     * - If no position is specified, no specific order is guaranteed.
     *
     * This property is used for display purposes only and does not affect
     * validation or serialization.
     */
    position?: number,
};

/**
 * The map of attribute types to their definitions.
 */
type ContentDefinitionMap = {
    boolean: {
        /**
         * The labels of the two possible values.
         */
        label?: {
            /**
             * The label for the true value.
             */
            true: string,

            /**
             * The label for the false value.
             */
            false: string,
        },

        /**
         * The value to pre-select in the user interface.
         *
         * Interfaces should use this value to preselect the default value as follows:
         *
         * - If a default value is specified, that value must be selected by default
         * - If no default value is specified, then no value may be selected by default,
         * and an explicit value must be required
         *
         * This property is used for display purposes only and does not affect
         * validation or serialization. It does not affect the default value of
         * the attribute when absent.
         */
        default?: boolean,
    },
    text: {
        /**
         * The minimum length (inclusive).
         */
        minimumLength?: number,

        /**
         * The maximum length (inclusive).
         */
        maximumLength?: number,

        /**
         * The predefined format.
         */
        format?: string,

        /**
         * The regular expression specifying the allowed pattern.
         */
        pattern?: string,

        /**
         * The map of choice values to definitions.
         */
        choices?: Record<string, ChoiceDefinition>,
    },
    number: {
        /**
         * Whether to allow integral numbers only.
         *
         * JavaScript does not have distinct types for integers and floating-point values.
         * Therefore, the presence or absence of a decimal point is not enough to distinguish
         * between integers and non-integers. For example, `1` and `1.0` are two ways to represent
         * the same value in JSON. Schemas must consider that value an integer no matter which
         * representation was used.
         */
        integer?: boolean,

        /**
         * The minimum allowed value (inclusive).
         */
        minimum?: number,

        /**
         * The maximum allowed value (inclusive).
         */
        maximum?: number,
    },
    structure: {
        /**
         * The map of attribute names to definitions.
         */
        attributes: {
            [key: string]: AttributeDefinition,
        },
    },
    list: {
        /**
         * The type of the list items.
         */
        items: ContentDefinition,

        /**
         * A label to prefix items in the user interface.
         *
         * Interfaces should use this value to prefix items as follows:
         *
         * - If a label is specified, that label must be used to identify items.
         * For example, if the label is `Tag`, the first item must be labeled
         * `Tag 1`, the second `Tag 2`, and so on.
         * - If the item is a structure, and the structure has a title, that
         * title must be used as the prefix. For example, if the structure
         * has a title `Card`, the first item must be labeled `Card 1`, the
         * second `Card 2`, and so on.
         * - If none of the above applies, a generic label, such as `Item`,
         * must be used to prefix items.
         *
         * This property is used for display purposes only and does not affect
         * validation or serialization.
         */
        itemLabel?: string,

        /**
         * The minimum number of items (inclusive).
         */
        minimumLength?: number,

        /**
         * The maximum number of items (inclusive).
         */
        maximumLength?: number,
    },
    union: {
        /**
         * The map of type names to definitions.
         */
        types: Record<string, ContentDefinition<'structure' | 'reference'>>,
    },
    reference: {
        /**
         * The ID of the referenced structure.
         */
        id: string,

        /**
         * Extra properties to merge with the referenced definition.
         */
        properties?: Record<string, any>,
    },
};

/**
 * The set of all content definition types.
 */
export type ContentDefinitionType = keyof ContentDefinitionMap;

/**
 * The map of logical types to their definitions.
 *
 * This interface can be augmented to add support for custom types.
 * For example, to add support for a new type named `color`,
 * create a new declaration file with the following content:
 *
 * @example
 * declare module '@croct-tech/content-model/definition' {
 *    interface LogicalDefinitionMap {
 *        color: {
 *           type: 'text',
 *           format: 'color';
 *        }
 *    }
 * }
 */
export interface LogicalDefinitionMap {
}

/**
 * The set of all logical definition types.
 */
export type LogicalDefinitionType = keyof LogicalDefinitionMap;

/**
 * An augmented content definition.
 *
 * Logical types provide a way to define extensions to the content model
 * that add semantic meaning to the content. For example, a logical type
 * named `media` can be used to represent a media type, such as an image
 * or a video. Consumers of the content model can then use this information
 * to provide a better editing experience and feedback, such as a file picker
 * for media types or a rich text editor for rich text types.
 *
 * A logical content type must always be validated against the constraints
 * of the underlying content type. Implementations may ignore unknown logical
 * types and treat them as regular content types with no extra constraints.
 *
 * Logical types are defined by augmenting the {@link LogicalDefinitionMap}
 * interface.
 *
 * @typeParam T The logical type name.
 */
export type LogicalDefinition<T extends LogicalDefinitionType = LogicalDefinitionType> =
    BaseContentDefinition<LogicalDefinitionMap[T]['type']> & BaseLogicalDefinition<T>;

/**
 * The base definition of a logical type.
 *
 * @typeParam T The logical type name.
 */
type BaseLogicalDefinition<T extends LogicalDefinitionType = LogicalDefinitionType> =
    {[P in T]: {logicalType: P} & Omit<LogicalDefinitionMap[P], 'type'>}[T];

/**
 * A template for a content definition.
 *
 * @typeParam T The logical type name.
 */
export type TemplateDefinition<T extends LogicalDefinitionType = LogicalDefinitionType> =
    BaseContentDefinition<LogicalDefinitionMap[T]['type']>
    & {template: true}
    & Partial<BaseLogicalDefinition<T>>;

/**
 * A content definition augmented with logical types.
 *
 * @typeParam T The type of the content definition.
 */
type DerivedLogicalDefinition<T extends ContentDefinitionType> = {
    [K in LogicalDefinitionType]: LogicalDefinitionMap[K]['type'] extends T
        ? (LogicalDefinition<K> & {template?: false}) | TemplateDefinition<K>
        : never;
}[LogicalDefinitionType];

/**
 * The base definition of a content definition.
 */
type BaseContentDefinition<T extends ContentDefinitionType = ContentDefinitionType> = {
    [K in keyof ContentDefinitionMap]: ContentDefinitionMap[K] & Annotations & {
    type: K,
}
}[T];

/**
 * The definition of a content type.
 */
export type ContentDefinition<T extends ContentDefinitionType = ContentDefinitionType> =
    (BaseContentDefinition<T> & {logicalType?: never}) | DerivedLogicalDefinition<T>;

/**
 * A root definition.
 */
export type RootDefinition = ContentDefinition<'structure' | 'union'>;

/**
 * A utility type that excludes content references from a content definition.
 *
 * This type works recursively on structure and union definitions, meaning that
 * it can be used on {@link ContentDefinition}, {@link RootDefinition},
 * or any other definition that may contain references.
 *
 * @typeParam T The content definition type.
 */
export type Resolved<T> = T extends Record<string, unknown>
    ? Exclude<{[K in keyof T]: Resolved<T[K]>}, ContentDefinition<'reference'> | TemplateDefinition>
    : T;

/**
 * The set of all content definition types excluding references.
 *
 * This type is the same as {@link ContentDefinitionType} except that it excludes
 * the `reference` type.
 */
export type ResolvedDefinitionType = Exclude<ContentDefinitionType, 'reference'>;

/**
 * A content definition excluding references in all its nested structures.
 *
 * This type is the same as {@link ContentDefinition} except that it excludes
 * the `reference` type.
 *
 * @typeParam T The content definition type.
 */
export type ResolvedDefinition<
    T extends ResolvedDefinitionType = ResolvedDefinitionType
> = Resolved<ContentDefinition<T>>;

/**
 * A root definition excluding references in all its nested structures.
 *
 * This type is the same as {@link RootDefinition} except that it excludes
 * the `reference` type.
 */
export type ResolvedRootDefinition = ResolvedDefinition<'structure' | 'union'>;

/**
 * A self-contained content definition.
 */
export type ContentDefinitionBundle = {
    /**
     * The root content definition.
     */
    root: ContentDefinition,

    /**
     * The map of referenced content definitions.
     */
    definitions: Record<string, ContentDefinition>,
};
