import React from 'react'
import { LogEntry } from '@/lib/logger'
import './logs.css'

export type LogProps = {
	log: LogEntry
}

export const Log: React.FC<LogProps> = ({ log }) => {
	return (
		<div className={`log ${log.type}`}>
			<div className='log-header'>
				<span>{log.timestamp}</span>
				{/* <span>{log.funcName}</span> */}
			</div>
			<div className='log-body'>{log.message}</div>
		</div>
	)
}
