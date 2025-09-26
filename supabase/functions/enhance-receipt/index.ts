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

  if (!openAIApiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log('Enhancing receipt image with AI...');

    // Use OpenAI Vision API to analyze and enhance the receipt
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at enhancing receipt images. Analyze the image and provide instructions for cropping, rotating, and enhancing it to highlight the receipt document. Focus on making the text clear and readable.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this receipt image and provide enhancement instructions. Return a JSON with: {"needsRotation": boolean, "rotationDegrees": number, "cropSuggestion": {"x": number, "y": number, "width": number, "height": number}, "brightnessAdjustment": number, "contrastAdjustment": number}'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    
    console.log('AI Analysis:', analysisText);

    // For now, return the original image with basic processing
    // In a production environment, you would implement actual image processing
    // based on the AI analysis using libraries like sharp or similar
    
    // Simple enhancement: return original image (placeholder for actual processing)
    const enhancedImage = base64Image;

    return new Response(JSON.stringify({ 
      enhancedImage,
      analysis: analysisText,
      originalSize: arrayBuffer.byteLength
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhance-receipt function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});