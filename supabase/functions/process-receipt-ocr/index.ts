import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

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
    if (!lovableApiKey) {
      console.error('Lovable API key not found');
      return new Response(
        JSON.stringify({ error: 'Lovable API key not configured' }),
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

    console.log('Processing receipt OCR with Lovable AI');

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Lovable AI API error:', response.status, errorData);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'API credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lovable AI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    console.log('OCR response:', extractedText);

    // Try to parse the JSON response
    let extractedData;
    try {
      // Handle markdown code blocks
      let jsonStr = extractedText;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      extractedData = JSON.parse(jsonStr.trim());
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
