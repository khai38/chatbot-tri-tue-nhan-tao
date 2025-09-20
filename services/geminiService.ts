import { GoogleGenAI, Type } from "@google/genai";
import type { Source, Citation } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        answer: {
            type: Type.STRING,
            description: "The detailed answer to the user's question, synthesized from the provided sources.",
        },
        citations: {
            type: Type.ARRAY,
            description: "A list of direct quotes from the sources that support the answer.",
            items: {
                type: Type.OBJECT,
                properties: {
                    sourceId: {
                        type: Type.STRING,
                        description: "The unique ID of the source document being cited.",
                    },
                    quote: {
                        type: Type.STRING,
                        description: "The exact quote from the source document that was used to formulate the answer. For image sources, this should be a description of the relevant visual elements.",
                    },
                },
                required: ["sourceId", "quote"],
            },
        },
    },
    required: ["answer", "citations"],
};


export async function querySources(question: string, sources: Source[]): Promise<{ answer: string; citations: Omit<Citation, 'sourceTitle'>[] }> {
    if (!process.env.API_KEY) {
        throw new Error("Biến môi trường API_KEY chưa được đặt.");
    }
    if (sources.length === 0) {
        throw new Error("Không thể truy vấn khi không có nguồn. Vui lòng thêm ít nhất một nguồn.");
    }

    const instruction = `Bạn là một trợ lý nghiên cứu chuyên nghiệp. Nhiệm vụ của bạn là trả lời câu hỏi của người dùng *chỉ* dựa trên thông tin được cung cấp trong các nguồn dưới đây.

1. Phân tích kỹ các nguồn sau. Mỗi nguồn có một ID, TIÊU ĐỀ và NỘI DUNG duy nhất. Nội dung có thể là văn bản hoặc hình ảnh.
2. Tổng hợp câu trả lời cho câu hỏi của người dùng.
3. Đối với mỗi mẩu thông tin trong câu trả lời của bạn, bạn PHẢI cung cấp một trích dẫn trực tiếp từ nguồn hỗ trợ nó. Đối với các nguồn hình ảnh, hãy mô tả yếu tố hình ảnh hỗ trợ câu trả lời của bạn dưới dạng "trích dẫn".
4. Nếu các nguồn không chứa thông tin để trả lời câu hỏi, hãy nêu rõ điều đó và không cung cấp bất kỳ thông tin nào không có trong nguồn.
5. Định dạng phản hồi của bạn theo lược đồ JSON được cung cấp.
6. QUAN TRỌNG: Bạn PHẢI trả lời bằng TIẾNG VIỆT.

Đây là các nguồn:`;

    const promptParts: any[] = [{ text: instruction }];

    sources.forEach(source => {
        if (source.content.mimeType.startsWith('text/')) {
            const textContext = `\n\n--- SOURCE START ---\nID: ${source.id}\nTITLE: ${source.title}\nCONTENT:\n${source.content.data}\n--- SOURCE END ---`;
            promptParts.push({ text: textContext });
        } else if (source.content.mimeType.startsWith('image/')) {
            const imageHeader = `\n\n--- SOURCE START ---\nID: ${source.id}\nTITLE: ${source.title}\nCONTENT:\n[The content of this source is the following image]`;
            promptParts.push({ text: imageHeader });
            promptParts.push({
                inlineData: {
                    mimeType: source.content.mimeType,
                    data: source.content.data
                }
            });
            promptParts.push({ text: `\n--- SOURCE END ---` });
        }
    });

    promptParts.push({ text: `\n\nCâu hỏi của người dùng: "${question}"` });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: promptParts },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1, // Lower temperature for more factual, grounded responses
            },
        });
        
        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);

        return {
            answer: parsedResponse.answer || "Không thể tạo câu trả lời.",
            citations: parsedResponse.citations || [],
        };
    } catch (error) {
        console.error("Error querying Gemini API:", error);
        throw new Error("Không nhận được phản hồi hợp lệ từ AI. Mô hình có thể đã gặp sự cố khi tạo câu trả lời có cơ sở. Vui lòng thử diễn đạt lại câu hỏi của bạn.");
    }
}