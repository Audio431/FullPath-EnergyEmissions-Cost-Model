type MessageCallback = (message: RuntimeMessage, sender: any) => void;
type PortMessageCallback = (message: RuntimeMessage, port: browser.runtime.Port) => void;
type TabCallback = (tabId: number, changeInfo: any, tab: browser.tabs.Tab) => void;

export class MessagingService {
    private static instance: MessagingService;

    private callback?: MessageCallback;
    private portCallback?: PortMessageCallback;
    private updateCallback?: TabCallback;
    private updateActiveTabCallback?: TabCallback;

    private constructor() {
        browser.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
            this.callback && this.callback(message, sender);

            return false;
        });

        browser.runtime.onConnect.addListener((port) => {

            port.onMessage.addListener((message: any) => {
                this.portCallback && this.portCallback(message, port);
            });

            port.onDisconnect.addListener(() => {
                console.log('Port disconnected:', port.name);
            });
        });

        browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            // Don't use changeInfo.status === 'complete' because it's not always reliable
            this.updateCallback && this.updateCallback(tabId, changeInfo, tab);
        });

        browser.tabs.onActivated.addListener((activeInfo) => {
            this.updateActiveTabCallback && this.updateActiveTabCallback(activeInfo.tabId, {}, {} as browser.tabs.Tab);
        });
    }

    public static getInstance(): MessagingService {
        if (!MessagingService.instance) {
            MessagingService.instance = new MessagingService();
        }
        return MessagingService.instance;
    }

    public setMessageHandler(callback: MessageCallback): void {
        this.callback = callback;
    }

    public setOnUpdateListener(callback: TabCallback): void {
        this.updateCallback = callback;
    }

    public setPortMessageHandler(callback: PortMessageCallback): void {
        this.portCallback = callback;
    }

    public setOnActiveTabUpdateListener(callback: TabCallback): void {
        this.updateActiveTabCallback = callback;
    }

    public async sendToTab(tabId: number, msg: RuntimeMessage, tab: browser.tabs.Tab, retries = 5): Promise<void> {
        await browser.tabs.sendMessage(tabId, msg).then((response) => {
            response && console.log('Response from tab:', response);
        }).catch((error) => {
            if (error.message === 'Could not establish connection. Receiving end does not exist.') {
                if (retries > 0) {
                    console.log(`Tab is not ready yet: ${tab.url}. Retrying in 1 second... (Attempts left: ${retries})`);
                    setTimeout(() => {
                        this.sendToTab(tabId, msg, tab, retries - 1);
                    }, 1000);
                } else {
                    console.error(`Failed to send message to tab ${tabId} after multiple attempts.`);
                }
            } else {
                console.error('Error sending message to tab:', error);
            }
        });
    }

    public async sendToRuntime(msg: RuntimeMessage): Promise<void> {
        await browser.runtime.sendMessage(msg).then((response) => {
            response && console.log('Response from runtime:', response);
        }).catch((error) => {
            console.error('Error sending message to runtime:', error);
        });
    }

    public async sendPortMessage(port: browser.runtime.Port, msg: any): Promise<void> {
        port.postMessage(msg);
    }
}
