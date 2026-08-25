import React, { useRef, useEffect, useState } from "react";
import { Row, Col, Typography } from 'antd';
import { fmtDate } from '../../utils/dateFormat';

const SubHeader = (props) => {
    const { firstLetter,
        secondLetter,
        firstColor,
        secondColor,
        secondFBold } = props;
    const [page, setPage] = React.useState(0);
    let dt = new Date();
    let datestr = fmtDate(dt);

    const [adatestr, set_datestr] = useState(datestr)

    return (

        <>
            <Col span={16} >
                <Typography.Text style={{
                    fontSize: 40,
                    color: firstColor,
                    fontWeight: 'bold'
                }}>{firstLetter}</Typography.Text>
                <Typography.Text style={{
                    fontSize: 40,
                    color: secondColor,
                    fontWeight: secondFBold ? 'bold' : 'light'
                }}>{secondLetter}</Typography.Text>
            </Col>
            <Col span={8} offset={0} className="update-txt" style={{ textAlign: 'end',padding:10 }}>
                <Typography.Text style={{
                    fontSize: 18,
                    fontFamily: 'Sarabun',
                    fontWeight: 'bold',
                    opacity: '28%'
                }}>Real Time Report <br /> {adatestr}</Typography.Text>
            </Col>
        </>
    )
}

export default SubHeader;