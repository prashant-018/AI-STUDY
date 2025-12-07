import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate AI summary using OpenAI API
 * @param {string} noteContent - The note content to summarize
 * @param {string} summaryType - Type of summary: 'key_points', 'structured', 'simplified', 'exam_focus'
 * @param {string} summaryLength - Length: 'brief', 'standard', 'detailed'
 * @param {Object} advancedOptions - Additional options for customization
 * @returns {Promise<string>} Generated summary text
 */
export async function generateSummary(noteContent, summaryType, summaryLength, advancedOptions = {}) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    // Build system prompt based on summaryType
    let systemPrompt = 'You are an expert educational content summarizer. Your task is to create clear, accurate, and well-structured summaries of educational notes.';

    switch (summaryType) {
        case 'key_points':
            systemPrompt += '\n\nCreate a bullet-point summary highlighting the key concepts, main ideas, and important facts. Use clear, concise bullet points. Format:\n- Key point 1\n- Key point 2\n- Key point 3';
            break;
        case 'structured':
            systemPrompt += '\n\nOrganize the content by topics with clear headings and subheadings. Use a hierarchical structure for better readability. Include:\n- Main topics as headings\n- Subtopics as subheadings\n- Key information under each section';
            break;
        case 'simplified':
            systemPrompt += '\n\nSimplify the content for easy understanding. Use simple language, avoid jargon when possible, and use analogies if helpful. Make it accessible for quick comprehension.';
            break;
        case 'exam_focus':
            systemPrompt += '\n\nFocus on exam-relevant concepts, formulas, definitions, and important facts. Highlight what is most likely to be tested. Include:\n- Key definitions\n- Important formulas\n- Critical concepts\n- Common exam topics';
            break;
        default:
            systemPrompt += '\n\nCreate a comprehensive summary covering all important aspects.';
    }

    // Add length instructions
    const lengthGuide = {
        brief: 'Keep it very concise, 50-100 words only. Focus on the most essential points.',
        standard: 'Provide a balanced summary of 200-300 words with good coverage of main topics.',
        detailed: 'Create a comprehensive summary of 400-500 words with thorough coverage and depth.',
    };

    systemPrompt += `\n\nLength requirement: ${lengthGuide[summaryLength] || lengthGuide.standard}`;

    // Add advanced options to prompt
    if (advancedOptions?.includeExamples) {
        systemPrompt += '\n\nInclude practical examples for each concept to enhance understanding.';
    }

    if (advancedOptions?.includeDiagrams) {
        systemPrompt += '\n\nNote: Include descriptions of diagrams or visual aids that would help explain the concepts.';
    }

    if (advancedOptions?.focusAreas && advancedOptions.focusAreas.length > 0) {
        systemPrompt += `\n\nFocus especially on these areas: ${advancedOptions.focusAreas.join(', ')}.`;
    }

    if (advancedOptions?.customInstructions && advancedOptions.customInstructions.trim()) {
        systemPrompt += `\n\nAdditional instructions: ${advancedOptions.customInstructions}`;
    }

    systemPrompt += '\n\nEnsure the summary is accurate, well-organized, and maintains the educational value of the original content.';

    try {
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: `Summarize this educational note:\n\n${noteContent}`,
                },
            ],
            max_tokens: summaryLength === 'brief' ? 200 : summaryLength === 'standard' ? 500 : 1000,
            temperature: 0.7,
        });

        // Extract text from response
        const summaryText = completion.choices[0]?.message?.content;

        if (!summaryText) {
            throw new Error('Empty response from OpenAI API');
        }

        return summaryText.trim();
    } catch (error) {
        console.error('OpenAI API Error:', error);

        // Handle specific API errors
        if (error.status === 401) {
            throw new Error('Invalid OpenAI API key. Please check your configuration.');
        }
        if (error.status === 429) {
            throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        }
        if (error.status === 500) {
            throw new Error('OpenAI API server error. Please try again later.');
        }

        throw new Error(error.message || 'Failed to generate summary');
    }
}
