import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { imageUrl, imageBase64 } = await req.json();

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image URL or base64 data is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Processing receipt OCR with OpenAI GPT-5');

    // Prepare the image input
    let imageInput;
    if (imageBase64) {
      imageInput = {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`
        }
      };
    } else {
      imageInput = {
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting information from receipts and invoices. Analyze the image and extract the following information in JSON format:
            {
              "vendor": "vendor/store name",
              "amount": "total amount as string with currency symbol",
              "date": "date in YYYY-MM-DD format",
              "items": ["list of main items purchased"],
              "category": "suggested category (materials, labor, equipment, travel, etc.)",
              "confidence": "confidence level from 0-1"
            }
            
            If you cannot find specific information, use null for that field. Be as accurate as possible.`
          },
          {
            role: 'user',
            content: [
              {
                type: "text",
                text: "Please analyze this receipt and extract the information as requested."
              },
              imageInput
            ]
          }
        ],
        max_completion_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    console.log('OCR response:', extractedText);

    // Try to parse the JSON response
    let extractedData;
    try {
      extractedData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      // If JSON parsing fails, return a basic structure
      extractedData = {
        vendor: null,
        amount: null,
        date: null,
        items: [],
        category: null,
        confidence: 0.5,
        rawText: extractedText
      };
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: extractedData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in process-receipt-ocr function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process receipt'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});