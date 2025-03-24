export type EmailInfo = {
    recipient: string,
    sender?: string,
    subject?: string,
    timestamp?: number,
};

export interface EmailLinkTemplate {
    generate(info: EmailInfo): URL;
}

export interface EmailProviderDetector {
    detect(email: string): Promise<string|null>;
}

export type Configuration = {
    detector: EmailProviderDetector,
    templates: Record<string, EmailLinkTemplate>,
};

export class EmailLinkGenerator {
    private readonly detector: EmailProviderDetector;

    private readonly templates: Record<string, EmailLinkTemplate>;

    public constructor(configuration: Configuration) {
        this.detector = configuration.detector;
        this.templates = configuration.templates;
    }

    public async generate(info: EmailInfo): Promise<URL|null> {
        const provider = await this.detector.detect(info.recipient);

        if (provider === null || this.templates[provider] === undefined) {
            return null;
        }

        return this.templates[provider].generate(info);
    }
}
