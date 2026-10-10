function AnomalyCard({ location, aqi, timestamp }) {
  return (
    <div>
      <h3 className="text-red-600 text-2xl">{location}</h3>
      <p>{aqi}</p>
      <p>{timestamp}</p>
    </div>
  )
}

export default AnomalyCard