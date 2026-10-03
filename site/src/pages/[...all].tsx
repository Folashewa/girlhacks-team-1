import { Link } from 'react-router-dom'
import '../components/grove/grove.css'
import { Starfield } from '../components/grove/Starfield'
import { APP_NAME } from '../constants'

export default function NotFound() {
  return (
    <div className="grove flex flex-col items-center justify-center px-6 text-center">
      <title>{`Not found · ${APP_NAME}`}</title>
      <Starfield />
      <h1 className="grove-title relative mb-3 text-4xl">404</h1>
      <p className="grove-story relative mb-8 text-2xl" style={{ color: 'var(--gold-soft)' }}>
        This path wanders out of the grove.
      </p>
      <Link to="/" className="grove-btn relative">
        Back to Grovekeeper
      </Link>
    </div>
  )
}
