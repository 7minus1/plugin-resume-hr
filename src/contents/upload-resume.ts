import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('Message handler received request:', req)
  
  const { file, token } = req.body
  console.log('Processing file upload...')

  try {
    const formData = new FormData()
    formData.append('file', file)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30秒超时

    console.log('Sending request to server...')
    const response = await fetch('http://localhost:3000/api/resume/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
      signal: controller.signal
    })

    clearTimeout(timeout)
    console.log('Server response:', response.status)

    if (response.ok) {
      console.log('Upload successful')
      res.send({ success: true })
    } else {
      const errorData = await response.json().catch(() => null)
      console.error('Upload failed:', errorData)
      res.send({ 
        success: false, 
        error: errorData?.message || '上传失败'
      })
    }
  } catch (error) {
    console.error('Error in message handler:', error)
    if (error.name === 'AbortError') {
      res.send({ success: false, error: '请求超时，请重试' })
    } else {
      res.send({ success: false, error: error.message || '上传出错' })
    }
  }
}

export default handler 