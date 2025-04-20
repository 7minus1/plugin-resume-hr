import type { PlasmoMessaging } from "@plasmohq/messaging"
import { config } from './config/env';

export const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  if (req.name !== "upload-resume") return

  const { file, token } = req.body

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${config.API_BASE_URL}/resume/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (response.ok) {
      res.send({ success: true })
    } else {
      res.send({ success: false, error: '上传失败' })
    }
  } catch (error) {
    res.send({ success: false, error: error.message })
  }
}
